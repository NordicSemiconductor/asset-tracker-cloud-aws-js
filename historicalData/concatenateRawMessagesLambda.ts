import { S3 } from 'aws-sdk'

import { collectFiles } from './collectFiles'
import { concatenateFiles } from './concatenateFiles'
import { concatenateRawMessages } from './concatenateRawMessages'
import { fromEnv } from '../util/fromEnv'

const s3 = new S3()
const { Bucket } = fromEnv({ Bucket: 'HISTORICAL_DATA_BUCKET' })(process.env)

const collectFilesInBucket = collectFiles({ s3, Bucket })
const concatenateFilesInBucket = concatenateFiles({ s3, Bucket })

/**
 * Runs every hour and concatenates the raw device messages so it is more performant for Athena to query them.
 */
export const handler = async (): Promise<void> => {
	await concatenateRawMessages({
		collectFilesInBucket,
		concatenateFilesInBucket,
		documentType: 'documents',
	})
	await concatenateRawMessages({
		collectFilesInBucket,
		concatenateFilesInBucket,
		documentType: 'updates',
	})
}
