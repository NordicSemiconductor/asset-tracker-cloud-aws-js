import {
	CloudFormationClient,
	DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation'
import {
	GetRegistrationCodeCommand,
	IoTClient,
	RegisterCACertificateCommand,
	Tag,
	UpdateEventConfigurationsCommand,
} from '@aws-sdk/client-iot'
import { toObject } from '@nordicsemiconductor/cloudformation-helpers'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { copyFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { run } from '../process/run'
import { caFileLocations } from './caFileLocations'

export const defaultCAValidityInDays = 356

/**
 * Creates a CA certificate and registers it for Just-in-time provisioning
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const createCA = async (args: {
	certsDir: string
	iot: IoTClient
	cf: CloudFormationClient
	stack: string
	subject?: string
	attributes?: Record<string, string>
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
	daysValid?: number
	tags?: Tag[]
}): Promise<{ certificateId: string }> => {
	const { certsDir, log, debug, iot, cf } = args
	try {
		await fs.stat(certsDir)
	} catch {
		await fs.mkdir(certsDir)
		log(`Created ${certsDir}`)
	}

	const [stackOutput, registrationCode] = await Promise.all([
		// Fetch the stack configuration, we need the Thing Group and the role name
		cf
			.send(new DescribeStacksCommand({ StackName: args.stack }))
			.then(async ({ Stacks }) => {
				if (Stacks?.length === 0 || Stacks?.[0].Outputs === undefined) {
					throw new Error(`Stack ${args.stack} not found.`)
				}
				return toObject(Stacks[0].Outputs)
			}),
		// The registration code ties the CA to the individual AWS account
		iot
			.send(new GetRegistrationCodeCommand({}))
			.then(({ registrationCode }) => registrationCode),
	])

	log('CA Registration code', registrationCode)

	// Now generate the CA
	const verificationKey = path.join(
		certsDir,
		`${randomUUID()}.verification.key`,
	)
	const key = path.join(certsDir, `${randomUUID()}.key`)
	await Promise.all([
		run({
			command: 'openssl',
			args: ['genrsa', '-out', verificationKey, '2048'],
			log: debug,
		}),
		run({
			command: 'openssl',
			args: ['genrsa', '-out', key, '2048'],
			log: debug,
		}),
	])

	const cert = path.join(certsDir, `${randomUUID()}.pem`)
	await run({
		command: 'openssl',
		args: [
			'req',
			'-x509',
			'-new',
			'-nodes',
			'-key',
			key,
			'-sha256',
			'-days',
			`${args.daysValid ?? defaultCAValidityInDays}`,
			'-out',
			cert,
			'-subj',
			`/OU=${args.subject ?? args.stack}`,
		],
		log: debug,
	})

	const csr = path.join(certsDir, `${randomUUID()}.csr`)
	await run({
		command: 'openssl',
		args: [
			'req',
			'-new',
			'-key',
			verificationKey,
			'-out',
			csr,
			'-subj',
			`/CN=${registrationCode}`,
		],
		log: debug,
	})

	const verificationCert = path.join(
		certsDir,
		`${randomUUID()}.verificationCert.pem`,
	)
	await run({
		command: 'openssl',
		args: [
			'x509',
			'-req',
			'-in',
			csr,
			'-CA',
			cert,
			'-CAkey',
			key,
			'-CAcreateserial',
			'-out',
			verificationCert,
			'-days',
			`${args.daysValid ?? defaultCAValidityInDays}`,
			'-sha256',
		],
		log: debug,
	})

	const [caCertificate, verificationCertificate] = await Promise.all([
		fs.readFile(cert, 'utf-8'),
		fs.readFile(verificationCert, 'utf-8'),
	])

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

	const jitpTemplate: any = {
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

	if (args.attributes !== undefined) {
		jitpTemplate.Resources.thing.Properties.AttributePayload = args.attributes
	}

	const res = await iot.send(
		new RegisterCACertificateCommand({
			caCertificate,
			verificationCertificate,
			allowAutoRegistration: true,
			setAsActive: true,
			registrationConfig: {
				templateBody: JSON.stringify(jitpTemplate),
				roleArn: stackOutput?.jitpRoleArn,
			},
			tags: args.tags ?? [],
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
		writeFile(files.cert, caCertificate, 'utf-8'),
		copyFile(key, files.key),
	])
	log(`Created CA certificate in ${files.cert}`)

	await Promise.all(
		[verificationKey, key, cert, csr, verificationCert].map(async (f) =>
			unlink(f),
		),
	)

	return {
		certificateId: res.certificateId,
	}
}
