import { CommandDefinition } from './CommandDefinition'
import { query } from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	UpdatesTableName,
	DocumentsTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { region } from '../../cdk/regions'

export const dropAthenaResourcesCommand = (): CommandDefinition => ({
	command: 'drop-athena-resources',
	action: async () => {
		const athena = new Athena({ region })

		const WorkGroup = WorkGroupName()
		const dbName = DataBaseName()
		const updatesTableName = UpdatesTableName()
		const documentsTableName = DocumentsTableName()

		const q = query({
			athena,
			WorkGroup,
			debugLog: (...args: any) => {
				console.log('[Athena]', ...args.map((a: any) => JSON.stringify(a)))
			},
			errorLog: (...args: any) => {
				console.error('[Athena]', ...args.map((a: any) => JSON.stringify(a)))
			},
		})

		await q({ QueryString: `DROP TABLE ${dbName}.${updatesTableName}` })
		await q({ QueryString: `DROP TABLE ${dbName}.${documentsTableName}` })

		await q({
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
