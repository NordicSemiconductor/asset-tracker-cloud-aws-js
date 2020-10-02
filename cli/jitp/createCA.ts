import { Iot, CloudFormation } from 'aws-sdk'
import { promises as fs } from 'fs'
import { caFileLocations } from './caFileLocations'
import { run } from '../process/run'
import { toObject } from '@bifravst/cloudformation-helpers'
import { region } from '../../cdk/regions'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackId'

/**
 * Creates a CA certificate and registers it for Just-in-time provisioning
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const createCA = async (args: {
	certsDir: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
}): Promise<{ certificateId: string }> => {
	const { certsDir, log, debug } = args
	const iot = new Iot({ region })
	const cf = new CloudFormation({ region })
	const caFiles = caFileLocations(certsDir)
	try {
		await fs.stat(certsDir)
	} catch {
		await fs.mkdir(certsDir)
		log(`Created ${certsDir}`)
	}

	let certExists = false
	try {
		await fs.stat(caFiles.cert)
		certExists = true
	} catch {
		// pass
	}
	if (certExists) {
		throw new Error(`CA Certificate exists: ${caFiles.cert}!`)
	}

	const [stackOutput, registrationCode] = await Promise.all([
		// Fetch the stack configuration, we need the Thing Group and the role name
		cf
			.describeStacks({ StackName: CORE_STACK_NAME })
			.promise()
			.then(async ({ Stacks }) => {
				if (Stacks?.length === 0 || Stacks?.[0].Outputs === undefined) {
					throw new Error(`Stack ${CORE_STACK_NAME} not found.`)
				}
				return toObject(Stacks[0].Outputs)
			}),
		// The registration code ties the CA to the individual AWS account
		iot
			.getRegistrationCode()
			.promise()
			.then(({ registrationCode }) => registrationCode),
	])

	log('CA Registration code', registrationCode)

	// Now generate the CA

	await Promise.all([
		run({
			command: 'openssl',
			args: ['genrsa', '-out', caFiles.verificationKey, '2048'],
			log: debug,
		}),
		run({
			command: 'openssl',
			args: ['genrsa', '-out', caFiles.key, '2048'],
			log: debug,
		}),
	])

	await run({
		command: 'openssl',
		args: [
			'req',
			'-x509',
			'-new',
			'-nodes',
			'-key',
			caFiles.key,
			'-sha256',
			'-days',
			'365',
			'-out',
			caFiles.cert,
			'-subj',
			`/OU=${CORE_STACK_NAME}`,
		],
		log: debug,
	})

	await run({
		command: 'openssl',
		args: [
			'req',
			'-new',
			'-key',
			caFiles.verificationKey,
			'-out',
			caFiles.csr,
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
			caFiles.csr,
			'-CA',
			caFiles.cert,
			'-CAkey',
			caFiles.key,
			'-CAcreateserial',
			'-out',
			caFiles.verificationCert,
			'-days',
			'365',
			'-sha256',
		],
		log: debug,
	})

	log(`Created CA certificate in ${caFiles.cert}`)

	const [caCertificate, verificationCertificate] = await Promise.all([
		fs.readFile(caFiles.cert, 'utf-8'),
		fs.readFile(caFiles.verificationCert, 'utf-8'),
	])

	await iot
		.updateEventConfigurations({
			eventConfigurations: {
				CA_CERTIFICATE: {
					Enabled: true,
				},
				CERTIFICATE: {
					Enabled: true,
				},
			},
		})
		.promise()

	const res = await iot
		.registerCACertificate({
			caCertificate,
			verificationCertificate,
			allowAutoRegistration: true,
			setAsActive: true,
			registrationConfig: {
				templateBody: JSON.stringify({
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
				}),
				roleArn: stackOutput?.jitpRoleArn,
			},
		})
		.promise()

	if (res?.certificateId === undefined) {
		throw new Error('Failed to register CA!')
	}

	await fs.writeFile(caFiles.id, res.certificateId, 'utf-8')

	log(
		`Registered CA and enabled auto-registration to group ${stackOutput?.thingGroupName}`,
	)

	return {
		certificateId: res.certificateId,
	}
}
