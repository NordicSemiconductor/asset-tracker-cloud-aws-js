import { ComandDefinition } from './CommandDefinition'
import {
	athenaQuery,
	createAthenaTableSQL,
	parseAthenaResult,
} from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	TableName,
	WorkGroupName,
} from '../../historicalData/settings'
import chalk from 'chalk'
import { deviceMessagesFields } from '../../historicalData/deviceMessages'

export const historicalDataCommand = ({
	stackId,
	region,
	QueryResultsBucketName,
	DataBucketName,
}: {
	stackId: string
	region: string
	QueryResultsBucketName: string
	DataBucketName: string
}): ComandDefinition => ({
	command: 'historical-data',
	options: [
		{
			flags: '-s, --setup',
			description: 'Set up the neccessary resources',
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

		const WorkGroup = WorkGroupName({ bifravstStackName: stackId })
		const dbName = DataBaseName({ bifravstStackName: stackId })
		const tableName = TableName({ bifravstStackName: stackId })

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

		const query = athenaQuery({
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
		const dbs = parseAthenaResult({
			ResultSet: await query({
				QueryString: `SHOW DATABASES`,
			}),
		})
		if (!dbs.find(({ database_name: db }) => db === dbName)) {
			if (setup) {
				console.log(chalk.magenta(`Creating database...`))
				await query({
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
			await query({ QueryString: `DROP TABLE ${dbName}.${tableName}` })
		}

		try {
			await query({
				QueryString: `DESCRIBE ${dbName}.${tableName}`,
			})
		} catch (error) {
			if (setup) {
				console.log(chalk.magenta(`Creating table...`))
				const createSQL = createAthenaTableSQL({
					database: dbName,
					table: tableName,
					s3Location: `s3://${DataBucketName}/`,
					fields: deviceMessagesFields,
				})
				console.log(chalk.magenta(createSQL))
				await query({
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

		console.log(
			chalk.green.inverse(' OK '),
			chalk.gray(
				`Athena table ${chalk.blue(`${dbName}.${tableName}`)} exists.`,
			),
		)
	},
	help: 'Manages the AWS Athena resources for historical data',
})
