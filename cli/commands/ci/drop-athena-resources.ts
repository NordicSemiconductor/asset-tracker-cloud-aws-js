import { ComandDefinition } from '../CommandDefinition'
import { athenaQuery } from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../../../historicalData/settings'

export const dropAthenaResourcesCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): ComandDefinition => ({
	command: 'drop-athena-resources',
	action: async () => {
		const athena = new Athena({ region })

		const WorkGroup = WorkGroupName({ bifravstStackName: stackId })
		const dbName = DataBaseName({ bifravstStackName: stackId })
		const tableName = UpdatesTableName({ bifravstStackName: stackId })

		const query = athenaQuery({
			athena,
			WorkGroup,
			debugLog: (...args: any) => {
				console.log('[Athena]', ...args.map((a: any) => JSON.stringify(a)))
			},
			errorLog: (...args: any) => {
				console.error('[Athena]', ...args.map((a: any) => JSON.stringify(a)))
			},
		})

		await query({ QueryString: `DROP TABLE ${dbName}.${tableName}` })

		await query({
			QueryString: `DROP DATABASE ${dbName}`,
		})

		console.log(`Deleting workgroup ${WorkGroup}...`)

		await athena
			.deleteWorkGroup({
				WorkGroup,
				RecursiveDeleteOption: true,
			})
			.promise()
	},
	help: 'Drops all Athena resources',
})
