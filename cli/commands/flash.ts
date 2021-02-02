import { CommandDefinition } from './CommandDefinition'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
	flashCredentials,
	connect,
	atHostHexfile,
	flash,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { Octokit } from '@octokit/rest'
import * as chalk from 'chalk'
import * as https from 'https'
import { v4 } from 'uuid'

const defaultPort = '/dev/ttyACM0'
const defaultSecTag = 42

const getLatestFirmware = async ({
	nbiot,
	nodebug,
	dk,
}: {
	nbiot: boolean
	nodebug: boolean
	dk: boolean
}) => {
	const octokit = new Octokit({
		auth: fs
			.readFileSync(
				path.resolve(process.env.HOME as 'string', '.netrc'),
				'utf-8',
			)
			.split(os.EOL)
			.find((s) => s.includes('machine api.github.com'))
			?.split(' ')[5],
	})
	const latestRelease = (
		await octokit.repos.listReleases({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-firmware',
			per_page: 1,
		})
	).data[0]
	const assets = (
		await octokit.repos.listReleaseAssets({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-firmware',
			release_id: latestRelease.id,
		})
	).data

	const hexfile = assets.find(
		({ name }) =>
			name.includes('.hex') &&
			name.includes(dk ? 'nRF9160DK' : 'Thingy91') &&
			name.includes(nbiot ? 'nbiot' : 'ltem') &&
			(nodebug ? name.includes('nodebug') : !name.includes('nodebug')),
	)

	if (hexfile === undefined) throw new Error(`Failed to detect latest release.`)

	const downloadTarget = path.join(os.tmpdir(), `${v4()}.hex`)
	console.log(chalk.magenta(`Downloading`), chalk.blue(hexfile.name))

	await new Promise((resolve) => {
		const file = fs.createWriteStream(downloadTarget)
		https.get(hexfile.browser_download_url, (response) => {
			https.get(response.headers.location as string, (response) => {
				response.pipe(file).on('close', resolve)
			})
		})
	})

	return downloadTarget
}

export const flashCommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'flash <deviceId>',
	options: [
		{
			flags: '--dk',
			description: `Flash a 9160 DK`,
		},
		{
			flags: '--nbiot',
			description: `Flash NB-IoT firmware`,
		},
		{
			flags: '--nodebugfw',
			description: `Flash no-debug firmware`,
		},
		{
			flags: '-p, --port <port>',
			description: `The port the device is connected to, defaults to ${defaultPort}`,
		},
		{
			flags: '-f, --firmware <firmware>',
			description: `Flash application from this file`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Use this secTag, defaults to ${defaultSecTag}`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async (
		deviceId: string,
		{ dk, nbiot, nodebugfw, port, firmware, secTag, debug },
	) => {
		const hexfile =
			firmware ?? (await getLatestFirmware({ dk, nbiot, nodebug: nodebugfw }))

		console.log(
			chalk.magenta(`Connecting to device`),
			chalk.blue(port ?? defaultPort),
		)

		const connection = await connect({
			atHostHexfile:
				dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91'],
			device: port ?? defaultPort,
			warn: console.error,
			debug: debug === true ? console.debug : undefined,
			progress: debug === true ? console.log : undefined,
		})

		console.log(
			chalk.magenta(`Flashing credentials`),
			chalk.blue(port ?? defaultPort),
		)

		const certs = deviceFileLocations({
			certsDir,
			deviceId,
		})

		await flashCredentials({
			at: connection.connection.at,
			caCert: fs.readFileSync(
				path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
				'utf-8',
			),
			secTag: secTag ?? defaultSecTag,
			clientCert: fs.readFileSync(certs.certWithCA, 'utf-8'),
			privateKey: fs.readFileSync(certs.key, 'utf-8'),
		})

		console.log(chalk.magenta(`Flashing firmware`), chalk.blue(hexfile))

		await flash({
			hexfile,
		})

		await connection.connection.end()

		console.log(chalk.green(`Done`))
	},
	help: 'Flash credentials and latest firmware release to a device using JLink',
})
