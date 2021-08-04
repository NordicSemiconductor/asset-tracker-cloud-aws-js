import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Either, right, left } from 'fp-ts/lib/Either'
import { Static } from '@sinclair/typebox'
import { pgpsRequestSchema } from './types'
import { URL } from 'url'

export type PGPSDataCache = Static<typeof pgpsRequestSchema> & {
	source: string
	url?: URL
	unresolved?: boolean
	updatedAt: Date
}

export const getCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (cacheKey: string): Promise<Either<ErrorInfo, PGPSDataCache>> => {
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
				url: entry.url !== undefined ? new URL(entry.url) : undefined,
				updatedAt: new Date(entry.updatedAt as string),
			} as PGPSDataCache

			console.debug(
				JSON.stringify({
					getCache: { entry: i },
				}),
			)
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
