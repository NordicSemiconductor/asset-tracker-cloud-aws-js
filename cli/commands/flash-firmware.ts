import { CommandDefinition } from './CommandDefinition'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { flash } from '@nordicsemiconductor/firmware-ci-device-helpers'
import { Octokit } from '@octokit/rest'
import * as chalk from 'chalk'
import * as https from 'https'
import { v4 } from 'uuid'
import { extractRepoAndOwner } from '../../cdk/helper/extract-repo-and-owner'

const defaultFirmwareRepository =
	'https://github.com/NordicSemiconductor/asset-tracker-cloud-firmware-aws'
const netrclocation = path.resolve(os.homedir(), '.netrc')

const getLatestFirmware = async ({
	nodebug,
	dk,
	firmwareRepository,
	ghToken,
}: {
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

export const flashFirmwareCommand = (): CommandDefinition => ({
	command: 'flash-firmware',
	options: [
		{
			flags: '--dk',
			description: `Flash a 9160 DK`,
		},
		{
			flags: '--nodebugfw',
			description: `Flash no-debug firmware`,
		},
		{
			flags: '-f, --firmware <firmware>',
			description: `Flash application from this file`,
		},
		{
			flags: '--gh-token <ghToken>',
			description: `GitHub token`,
		},
		{
			flags: '-r, --firmware-repository <firmwareRepository>',
			description: `Firmware repository to pull the release from.`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({
		dk,
		nodebugfw,
		firmware,
		ghToken,
		firmwareRepository,
		debug,
	}) => {
		if (
			firmwareRepository !== undefined &&
			firmware !== undefined // Both provided
		) {
			throw new Error(
				`Must provide either -f <firmware> or --repo <firmware repository URL>`,
			)
		}
		if (firmware === undefined) {
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
						chalk.greenBright(`node cli flash-firmare --gh-token`),
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
						chalk.greenBright(`node cli flash-firmare --firmware`),
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
				nodebug: nodebugfw,
				ghToken,
				firmwareRepository: firmwareRepository ?? defaultFirmwareRepository,
			}))

		await flash({
			hexfile,
			warn: console.error,
			debug: debug === true ? console.debug : undefined,
		})

		console.log(chalk.green(`Done`))
	},
	help: 'Flash (latest) firmware release to a device using JLink',
})
