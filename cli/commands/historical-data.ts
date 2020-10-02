import { CommandDefinition } from './CommandDefinition'
import { query, createTableSQL, parseResult } from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	UpdatesTableName,
	DocumentsTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import * as chalk from 'chalk'
import { deviceMessagesFields } from '../../historicalData/deviceMessages'
import { region } from '../../cdk/regions'

export const historicalDataCommand = ({
	QueryResultsBucketName,
	DataBucketName,
}: {
	QueryResultsBucketName: string
	DataBucketName: string
}): CommandDefinition => ({
	command: 'historical-data',
	options: [
		{
			flags: '-s, --setup',
			description: 'Set up the necessary resources',
		},
		{
			flags: '-r, --recreate',
			description: 'Recreates the historical data table',
		},
		{
			flags: '-d, --debug',
			description: 'Debug Athena queries',
		},
	],
	action: async ({
		setup,
		debug,
		recreate,
	}: {
		setup: boolean
		debug: boolean
		recreate: boolean
	}) => {
		const athena = new Athena({ region })

		const { WorkGroups } = await athena.listWorkGroups().promise()

		const WorkGroup = WorkGroupName()
		const dbName = DataBaseName()
		const updatesTableName = UpdatesTableName()
		const documentsTableName = DocumentsTableName()

		if (
			!WorkGroups ||
			!WorkGroups.find(
				({ Name, State }) => State === 'ENABLED' && Name === WorkGroup,
			)
		) {
			if (setup) {
				console.log(chalk.magenta(`Creating workgroup...`))
				const createWorkGroupArgs = {
					Name: WorkGroup,
					Description: 'Workgroup for Bifravst',
					Configuration: {
						ResultConfiguration: {
							OutputLocation: `s3://${QueryResultsBucketName}/`,
						},
					},
				}
				if (debug) {
					console.debug(chalk.gray('[Athena]'), createWorkGroupArgs)
				}
				await athena.createWorkGroup(createWorkGroupArgs).promise()
			} else {
				console.log(
					chalk.red.inverse(' ERROR '),
					chalk.red(
						`Athena workgroup ${chalk.blue(WorkGroup)} does not exist!`,
					),
				)
				console.log(
					chalk.red.inverse(' ERROR '),
					chalk.red(`Pass --setup to create it.`),
				)
				return
			}
		}
		console.log(
			chalk.green.inverse(' OK '),
			chalk.gray(`Athena workgroup ${chalk.blue(WorkGroup)} exists.`),
		)

		const q = query({
			athena,
			WorkGroup,
			debugLog: (...args: any) => {
				if (debug) {
					console.debug(
						chalk.gray('[Athena]'),
						...args.map((a: any) => chalk.blue(JSON.stringify(a))),
					)
				}
			},
			errorLog: (...args: any) => {
				console.error(
					chalk.red.inverse('[Athena]'),
					...args.map((a: any) => chalk.red(JSON.stringify(a))),
				)
			},
		})
		const dbs = parseResult({
			ResultSet: await q({
				QueryString: `SHOW DATABASES`,
			}),
		})
		if (!dbs.find(({ database_name: db }) => db === dbName)) {
			if (setup) {
				console.log(chalk.magenta(`Creating database...`))
				await q({
					QueryString: `CREATE DATABASE ${dbName}`,
				})
			} else {
				console.log(
					chalk.red.inverse(' ERROR '),
					chalk.red(`Athena database ${chalk.blue(dbName)} does not exist!`),
				)
				console.log(
					chalk.red.inverse(' ERROR '),
					chalk.red(`Pass --setup to create it.`),
				)
				return
			}
		}
		console.log(
			chalk.green.inverse(' OK '),
			chalk.gray(`Athena database ${chalk.blue(dbName)} exists.`),
		)

		if (recreate) {
			console.log(chalk.magenta(`Dropping table...`))
			await q({ QueryString: `DROP TABLE ${dbName}.${updatesTableName}` })
			await q({ QueryString: `DROP TABLE ${dbName}.${documentsTableName}` })
		}

		const checkTable = async ({
			tableName,
			setup,
			s3Location,
		}: {
			s3Location: string
			tableName: string
			setup: boolean
		}) => {
			try {
				await q({
					QueryString: `DESCRIBE ${dbName}.${tableName}`,
				})
			} catch (error) {
				if (setup) {
					console.log(chalk.magenta(`Creating table...`))
					const createSQL = createTableSQL({
						database: dbName,
						table: tableName,
						s3Location,
						fields: deviceMessagesFields,
					})
					console.log(chalk.magenta(createSQL))
					await q({
						QueryString: createSQL,
					})
				} else {
					console.log(
						chalk.red.inverse(' ERROR '),
						chalk.red(
							`Athena table ${chalk.blue(
								`${dbName}.${tableName}`,
							)} does not exist!`,
						),
					)
					console.log(
						chalk.red.inverse(' ERROR '),
						chalk.red(`Pass --setup to create it.`),
					)
					return
				}
			}
		}

		await checkTable({
			tableName: updatesTableName,
			setup,
			s3Location: `s3://${DataBucketName}/updates/`,
		})

		console.log(
			chalk.green.inverse(' OK '),
			chalk.gray(
				`Athena table ${chalk.blue(`${dbName}.${updatesTableName}`)} exists.`,
			),
		)

		await checkTable({
			tableName: documentsTableName,
			setup,
			s3Location: `s3://${DataBucketName}/documents/`,
		})

		console.log(
			chalk.green.inverse(' OK '),
			chalk.gray(
				`Athena table ${chalk.blue(`${dbName}.${documentsTableName}`)} exists.`,
			),
		)
	},
	help: 'Manages the AWS Athena resources for historical data',
})
