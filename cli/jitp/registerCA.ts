import {
	CloudFormationClient,
	DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation'
import {
	GetRegistrationCodeCommand,
	IoTClient,
	RegisterCACertificateCommand,
	UpdateEventConfigurationsCommand,
	type Tag,
} from '@aws-sdk/client-iot'
import { toObject } from '@nordicsemiconductor/cloudformation-helpers'
import { randomUUID } from 'crypto'
import { copyFile, readFile, unlink } from 'fs/promises'
import path from 'path'
import { run } from '../process/run.js'
import { caFileLocations } from './caFileLocations.js'

export const registerCA = async ({
	iot,
	cf,
	certsDir,
	attributes,
	caCertificateFile,
	caCertificateKeyFile,
	tags,
	stack,
	log,
	debug,
}: {
	certsDir: string
	iot: IoTClient
	cf: CloudFormationClient
	caCertificateFile: string
	caCertificateKeyFile: string
	attributes?: Record<string, string>
	tags?: Tag[]
	stack: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
}): Promise<{ certificateId: string }> => {
	// Fetch the stack configuration, we need the Thing Group and the role name
	const stackOutput = await cf
		.send(new DescribeStacksCommand({ StackName: stack }))
		.then(async ({ Stacks }) => {
			if (Stacks?.length === 0 || Stacks?.[0]?.Outputs === undefined) {
				throw new Error(`Stack ${stack} not found.`)
			}
			return toObject(Stacks[0].Outputs)
		})

	const verifcationCertId = randomUUID()
	const verificationKeyFile = path.join(certsDir, `${verifcationCertId}.key`)
	const verificationCertFile = path.join(certsDir, `${verifcationCertId}.pem`)
	const csrFile = path.join(certsDir, `${verifcationCertId}.csr`)

	await run({
		command: 'openssl',
		args: ['genrsa', '-out', verificationKeyFile, '2048'],
		log: debug,
	})

	const registrationCode = await iot
		.send(new GetRegistrationCodeCommand({}))
		.then(({ registrationCode }) => registrationCode)

	log('CA Registration code', registrationCode)

	await run({
		command: 'openssl',
		args: [
			'req',
			'-new',
			'-key',
			verificationKeyFile,
			'-out',
			csrFile,
			'-subj',
			`/CN=${registrationCode}`,
		],
		log: debug,
	})

	await run({
		command: 'openssl',
		args: [
			'x509',
			'-req',
			'-in',
			csrFile,
			'-CA',
			caCertificateFile,
			'-CAkey',
			caCertificateKeyFile,
			'-CAcreateserial',
			'-out',
			verificationCertFile,
			'-days',
			`1`,
			'-sha256',
		],
		log: debug,
	})

	await iot.send(
		new UpdateEventConfigurationsCommand({
			eventConfigurations: {
				CA_CERTIFICATE: {
					Enabled: true,
				},
				CERTIFICATE: {
					Enabled: true,
				},
			},
		}),
	)

	const jitpTemplate: Record<string, any> = {
		Parameters: {
			'AWS::IoT::Certificate::CommonName': {
				Type: 'String',
			},
			'AWS::IoT::Certificate::Id': {
				Type: 'String',
			},
		},
		Resources: {
			thing: {
				Type: 'AWS::IoT::Thing',
				Properties: {
					ThingName: {
						Ref: 'AWS::IoT::Certificate::CommonName',
					},
					ThingGroups: [stackOutput?.thingGroupName],
				},
			},
			cert: {
				Type: 'AWS::IoT::Certificate',
				Properties: {
					CertificateId: {
						Ref: 'AWS::IoT::Certificate::Id',
					},
					Status: 'ACTIVE',
				},
			},
		},
	}

	if (attributes !== undefined) {
		jitpTemplate.Resources.thing.Properties.AttributePayload = attributes
	}

	const res = await iot.send(
		new RegisterCACertificateCommand({
			caCertificate: await readFile(caCertificateFile, 'utf-8'),
			verificationCertificate: await readFile(verificationCertFile, 'utf-8'),
			allowAutoRegistration: true,
			setAsActive: true,
			registrationConfig: {
				templateBody: JSON.stringify(jitpTemplate),
				roleArn: stackOutput?.jitpRoleArn,
			},
			tags: tags ?? [],
		}),
	)

	if (res?.certificateId === undefined) {
		throw new Error('Failed to register CA!')
	}

	log(
		`Registered CA and enabled auto-registration to group ${stackOutput?.thingGroupName}`,
	)

	const files = caFileLocations({ certsDir, id: res.certificateId })

	await Promise.all([
		copyFile(caCertificateFile, files.cert),
		copyFile(caCertificateKeyFile, files.key),
	])

	log(`CA certificate location: ${files.cert}`)

	await Promise.all([
		unlink(verificationKeyFile),
		unlink(verificationCertFile),
		unlink(csrFile),
	])

	return {
		certificateId: res.certificateId,
	}
}
