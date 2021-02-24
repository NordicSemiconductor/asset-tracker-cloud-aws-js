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
import { extractRepoAndOwner } from '../../cdk/helper/extract-repo-and-owner'

const defaultPort = '/dev/ttyACM0'
const defaultSecTag = 42
const defaultFirmwareRepository =
	'https://github.com/NordicSemiconductor/asset-tracker-cloud-firmware'
const netrclocation = path.resolve(process.env.HOME as 'string', '.netrc')

const getLatestFirmware = async ({
	nbiot,
	nodebug,
	dk,
	firmwareRepository,
	ghToken,
}: {
	nbiot: boolean
	nodebug: boolean
	dk: boolean
	firmwareRepository: string
	ghToken: string
}) => {
	const { owner, repo } = extractRepoAndOwner(firmwareRepository)
	const octokit = new Octokit({
		auth: ghToken,
	})
	const latestRelease = (
		await octokit.repos.listReleases({
			owner,
			repo,
			per_page: 1,
		})
	).data[0]
	const assets = (
		await octokit.repos.listReleaseAssets({
			owner,
			repo,
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
			flags: '-a, --at-client <atClient>',
			description: `Flash at_client from this file`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
		{
			flags: '--gh-token <ghToken>',
			description: `GitHub token`,
		},
		{
			flags: '-r, --firmware-repository <firmwareRepository>',
			description: `Firmware repository to pull the release from.`,
		},
	],
	action: async (
		deviceId: string,
		{
			dk,
			nbiot,
			nodebugfw,
			port,
			firmware,
			secTag,
			debug,
			ghToken,
			atClient,
			firmwareRepository,
		},
	) => {
		if (
			(firmwareRepository === undefined && firmware === undefined) || // None provided
			(firmwareRepository !== undefined && firmware !== undefined) // Both provided
		) {
			throw new Error(
				`Must provide either -f <firmware> or --repo <firmware repository URL>`,
			)
		}
		if (firmwareRepository !== undefined) {
			if (ghToken === undefined) {
				try {
					ghToken = fs
						.readFileSync(netrclocation, 'utf-8')
						.split(os.EOL)
						.find((s) => s.includes('machine api.github.com'))
						?.split(' ')[5]
				} catch {
					console.error('')
					console.error(
						'',
						chalk.red('⚠️'),
						chalk.red(
							`Failed to read GitHub token from ${chalk.blue(netrclocation)}.`,
						),
					)
					console.error('')
					console.error(
						'',
						chalk.gray('ℹ️'),
						chalk.gray(`We use your GitHub token to query the release page of`),
					)
					console.error(
						'  ',
						chalk.gray(firmwareRepository ?? defaultFirmwareRepository),
					)
					console.error('')
					console.error(
						'  ',
						chalk.yellowBright(
							'Please provide a valid GitHub token in .netrc.',
						),
					)
					console.error('')
					console.error(
						'  ',
						chalk.yellowBright(
							`Add a line like this to ${chalk.blue(netrclocation)}:`,
						),
					)
					console.error('')
					console.error(
						'  ',
						chalk.white(
							'machine api.github.com login <your GitHub username> password <your personal access token>',
						),
					)
					console.error('')
					console.error(
						'  ',
						chalk.yellow.dim(
							'Learn more about .netrc: https://everything.curl.dev/usingcurl/netrc',
						),
					)
					console.error('')
					console.error(
						'  ',
						chalk.yellowBright(`Alternatively pass it as an argument:`),
					)
					console.error('')
					console.error(
						'  ',
						chalk.greenBright(`node cli flash --gh-token`),
						chalk.blueBright(`"your personal access token"`),
					)
					console.error('')
					console.error(
						'  ',
						chalk.yellowBright(
							`You can also download the latest release for your board manually from`,
						),
					)
					console.error(
						'  ',
						chalk.yellow(
							`${firmwareRepository ?? defaultFirmwareRepository}/releases`,
						),
					)
					console.error(
						'  ',
						chalk.yellowBright(
							`and provide the location to the hexfile as an argument:`,
						),
					)
					console.error('')
					console.error(
						'  ',
						chalk.greenBright(`node cli flash --firmware`),
						chalk.blueBright(`/path/to/firmware.hex`),
					)
					process.exit(1)
				}
			}
		}

		const hexfile =
			firmware ??
			(await getLatestFirmware({
				dk,
				nbiot,
				nodebug: nodebugfw,
				ghToken,
				firmwareRepository: firmwareRepository ?? defaultFirmwareRepository,
			}))

		console.log(
			chalk.magenta(`Connecting to device`),
			chalk.blue(port ?? defaultPort),
		)

		const connection = await connect({
			atHostHexfile:
				atClient ??
				(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
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
