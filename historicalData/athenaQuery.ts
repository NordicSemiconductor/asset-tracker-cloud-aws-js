import { Athena } from 'aws-sdk'
import { exponential } from 'backoff'
import { parseAthenaResult } from './parseAthenaResult'

const noop = () => undefined

export const athenaQuery = ({
	athena,
	WorkGroup,
	logDebug,
}: {
	athena: Athena
	WorkGroup: string
	logDebug?: (message: string) => void
}) => async ({ QueryString }: { QueryString: string }) => {
	const d = logDebug || noop
	d(QueryString)
	const { QueryExecutionId } = await athena
		.startQueryExecution({
			WorkGroup,
			QueryString,
		})
		.promise()
	if (!QueryExecutionId) {
		throw new Error(`Query failed!`)
	}

	await new Promise((resolve, reject) => {
		const b = exponential({
			randomisationFactor: 0,
			initialDelay: 1000,
			maxDelay: 5000,
		})
		b.failAfter(9) // 27750
		b.on('ready', async () => {
			const res = await athena.getQueryExecution({ QueryExecutionId }).promise()
			const State =
				(res.QueryExecution &&
					res.QueryExecution.Status &&
					res.QueryExecution.Status.State) ||
				'unknown'

			switch (State) {
				case 'RUNNING':
					console.debug(res)
					b.backoff()
					break
				case 'FAILED':
					console.error(res.QueryExecution)
					reject(new Error(`Query ${QueryExecutionId} failed!`))
					break
				case 'SUCCEEDED':
					resolve(res)
					break
				case 'unknown':
					reject(new Error(`Query ${QueryExecutionId} has unknown status!`))
					break
				default:
					console.error(res)
					reject(new Error(`Query ${QueryExecutionId} has unexpected status!`))
			}
		})
		b.on('fail', () => {
			reject(new Error(`Timed out waiting for query ${QueryExecutionId}`))
		})
		b.backoff()
	})

	const { ResultSet } = await athena
		.getQueryResults({ QueryExecutionId })
		.promise()

	if (!ResultSet || !ResultSet.Rows) {
		throw new Error(`No resultset returned.`)
	}
	return parseAthenaResult({ ResultSet })
}
