import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { geolocateCellFromCache, Cell } from '../geolocateCell'
import { toStatusCode } from '../ErrorInfo'
import { res } from './res'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE || '',
})

const inputSchema = new Ajv().compile({
	type: 'object',
	properties: {
		cell: {
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
	additionalProperties: false,
})

const allMembersToInt = (o: object) =>
	Object.entries(o).reduce(
		(o, [k, v]) => ({ ...o, [k]: v ? parseInt(v, 10) : 0 }),
		{},
	)

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
