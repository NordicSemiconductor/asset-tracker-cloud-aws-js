import { S3 } from 'aws-sdk'

import { collectFiles } from './collectFiles'
import { concatenateFiles } from './concatenateFiles'
import { concatenateRawMessages } from './concatenateRawMessages'

const s3 = new S3()
const Bucket = process.env.HISTORICAL_DATA_BUCKET || ''

const collectFilesInBucket = collectFiles({ s3, Bucket })
const concatenateFilesInBucket = concatenateFiles({ s3, Bucket })

/**
 * Runs every hour and concatenates the raw device messages so it is more performant for Athena to query them.
 */
export const handler = async () => {
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
