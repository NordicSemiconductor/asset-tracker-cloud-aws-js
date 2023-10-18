import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { Static } from '@sinclair/typebox'
import { ErrorType, type ErrorInfo } from '../api/ErrorInfo.js'
import type { agnssRequestSchema } from './types.js'

export type AGNSSDataCache = Static<typeof agnssRequestSchema> & {
	source: string
	dataHex?: string[]
	unresolved?: boolean
	updatedAt: Date
}

export const getCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (cacheKey: string): Promise<{ error: ErrorInfo } | AGNSSDataCache> => {
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
			return {
				...entry,
				updatedAt: new Date(entry.updatedAt as string),
				types: [...(entry.types as Set<number>)],
				dataHex:
					entry.dataHex !== undefined
						? [...(entry.dataHex as Set<string>)]
						: undefined,
			} as AGNSSDataCache
		} catch (err) {
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return {
					error: {
						type: ErrorType.EntityNotFound,
						message: `Report ${cacheKey} not found!`,
					},
				}
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
			return {
				error: {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				},
			}
		}
	}
