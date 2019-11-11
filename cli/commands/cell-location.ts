import { ComandDefinition } from './CommandDefinition'
import {
	athenaQuery,
	parseAthenaResult,
} from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	DocumentsTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import * as chalk from 'chalk'
import * as backoff from 'backoff'

export const cellLocation = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): ComandDefinition => ({
	command: 'cell-location <mccmnc> <area> <cell>',
	options: [
		{
			flags: '-d, --debug',
			description: 'Debug Athena queries',
		},
	],
	action: async (mccmnc, area, cell, { debug }) => {
		const athena = new Athena({ region })

		const WorkGroup = WorkGroupName({ bifravstStackName: stackId })
		const dbName = DataBaseName({ bifravstStackName: stackId })
		const tableName = DocumentsTableName({ bifravstStackName: stackId })

		const query = athenaQuery({
			athena,
			WorkGroup,
			backoff: (() => {
				const b = backoff.exponential({
					randomisationFactor: 0,
					initialDelay: 1000,
					maxDelay: 5000,
				});
				b.failAfter(100);
				return b;
			})(),
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
		const cellLocations = parseAthenaResult({
			ResultSet: await query({
				QueryString: `SELECT reported.gps.v.lat as lat, reported.gps.v.lng as lng
				FROM ${dbName}.${tableName} 
				WHERE reported.roam.v.cell = ${cell} 
				AND reported.roam.v.area = ${area}
				AND reported.roam.v.mccmnc = ${mccmnc}
				AND reported.gps IS NOT NULL 
				AND reported.gps.v.lat IS NOT NULL 
				AND reported.gps.v.lng IS NOT NULL`,
			}),
			skip: 1
		})

		console.log(cellLocations)

	},
	help: 'Resolve the geolocation of a cell',
})
