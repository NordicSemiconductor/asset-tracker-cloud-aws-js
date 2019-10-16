import { S3 } from 'aws-sdk';

import { collectFiles } from './collectFiles';
import { concatenateFiles } from './concatenateFiles';
import { concatenateRawDeviceMessages } from './concatenateRawDeviceMessages';

const s3 = new S3()
const Bucket = process.env.HISTORICAL_DATA_BUCKET || ''

const collectFilesInBucket = collectFiles({ s3, Bucket })
const concatenateFilesInBucket = concatenateFiles({ s3, Bucket })

/**
 * Runs every hour and concatenates the raw device messages so it is more performant for Athena to query them.
 */
const handler = async () => {
	await concatenateRawDeviceMessages({
		collectFilesInBucket,
		concatenateFilesInBucket,
		documentType: "documents"
	})
	await concatenateRawDeviceMessages({
		collectFilesInBucket,
		concatenateFilesInBucket,
		documentType: "updates"
	})
}

handler().catch(err => {
	console.error(err)
})
