import { CommandDefinition } from './CommandDefinition'
import { query, parseResult } from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'
import {
	DataBaseName,
	DocumentsTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import * as chalk from 'chalk'
import * as backoff from 'backoff'

export const cellLocation = ({
	region,
}: {
	region: string
}): CommandDefinition => ({
	command: 'cell-location <mccmnc> <area> <cell>',
	options: [
		{
			flags: '-d, --debug',
			description: 'Debug Athena queries',
		},
	],
	action: async (mccmnc, area, cell, { debug }) => {
		const athena = new Athena({ region })

		const WorkGroup = WorkGroupName()
		const dbName = DataBaseName()
		const tableName = DocumentsTableName()

		const q = query({
			athena,
			WorkGroup,
			runningBackoff: (() => {
				const b = backoff.exponential({
					randomisationFactor: 0,
					initialDelay: 1000,
					maxDelay: 5000,
				})
				b.failAfter(100)
				return b
			})(),
			debugLog: (...args: any) => {
				if (debug !== undefined) {
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
		const cellLocations = parseResult({
			ResultSet: await q({
				QueryString: `SELECT reported.gps.v.lat as lat, reported.gps.v.lng as lng
				FROM ${dbName}.${tableName} 
				WHERE reported.roam.v.cell = ${cell} 
				AND reported.roam.v.area = ${area}
				AND reported.roam.v.mccmnc = ${mccmnc}
				AND reported.gps IS NOT NULL 
				AND reported.gps.v.lat IS NOT NULL 
				AND reported.gps.v.lng IS NOT NULL`,
			}),
			skip: 1,
		})

		console.log(cellLocations)
	},
	help: 'Resolve the geolocation of a cell',
})
