import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Static } from '@sinclair/typebox'
import { Either, left, right } from 'fp-ts/lib/Either'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { agpsRequestSchema } from './types'

export type AGPSDataCache = Static<typeof agpsRequestSchema> & {
	source: string
	dataHex?: string[]
	unresolved?: boolean
	updatedAt: Date
}

export const getCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (cacheKey: string): Promise<Either<ErrorInfo, AGPSDataCache>> => {
		try {
			const { Item } = await dynamodb.send(
				new GetItemCommand({
					TableName,
					Key: {
						cacheKey: {
							S: cacheKey,
						},
					},
				}),
			)

			if (Item === undefined) throw new Error('NOT_FOUND')

			const entry = unmarshall(Item)
			const i = {
				...entry,
				updatedAt: new Date(entry.updatedAt as string),
				types: [...(entry.types as Set<number>)],
				dataHex:
					entry.dataHex !== undefined
						? [...(entry.dataHex as Set<string>)]
						: undefined,
			} as AGPSDataCache

			return right(i)
		} catch (err) {
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return left({
					type: ErrorType.EntityNotFound,
					message: `Report ${cacheKey} not found!`,
				})
			console.error(
				JSON.stringify({
					getCache: {
						err,
						errorMessage: (err as Error).message,
						id: cacheKey,
						TableName,
					},
				}),
			)
			return left({
				type: ErrorType.InternalError,
				message: (err as Error).message,
			})
		}
	}