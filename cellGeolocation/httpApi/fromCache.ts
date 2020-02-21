import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { geolocateCellFromCache, Cell } from '../geolocateCell'
import { toStatusCode } from '../ErrorInfo'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE || '',
})

const inputSchema = new Ajv().compile({
	type: 'object',
	properties: {
		cellId: {
			type: 'number',
			min: 1,
		},
		area: {
			type: 'number',
			min: 1,
		},
		mccmnc: {
			type: 'number',
			min: 10000,
		},
	},
	required: ['cell', 'area', 'mccmnc'],
})

const allMembersToInt = (o: object) =>
	Object.entries(o).reduce((o, [k, v]) => ({ ...o, [k]: parseInt(v, 10) }), {})

const res = (statusCode: number, options?: { expires: number }) => (
	body: any,
): T.Task<APIGatewayProxyResult> =>
	T.of({
		statusCode,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': 'application/json',
			...(options?.expires && {
				'Cache-Control': `public, max-age=${options.expires}`,
				Expires: new Date(
					new Date().getTime() + options.expires * 1000,
				).toUTCString(),
			}),
		},
		body: JSON.stringify(body),
	})

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))
	return pipe(
		validate<Cell>(inputSchema)(
			allMembersToInt(event.queryStringParameters || {}),
		)(),
		TE.fromEither,
		TE.chain(pipe(locator)),
		TE.fold(
			error =>
				res(toStatusCode[error.type], {
					expires: 3600,
				})(error),
			res(200, {
				expires: 86400,
			}),
		),
	)()
}
