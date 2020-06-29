import * as dateFns from 'date-fns'
import * as path from 'path'
import { v4 } from 'uuid'

import { CollectFilesFn } from './collectFiles'
import { ConcatenateFilesFn } from './concatenateFiles'

const dateRx = new RegExp(/^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})/)

export const concatenateRawMessages = async ({
	concatenateFilesInBucket,
	collectFilesInBucket,
	documentType,
}: {
	concatenateFilesInBucket: ConcatenateFilesFn
	collectFilesInBucket: CollectFilesFn
	documentType: 'updates' | 'documents'
}): Promise<void> => {
	// Concatenate hours
	await concatenateFilesInBucket({
		files: await collectFilesInBucket({
			Prefix: `${documentType}/raw/`,
			notAfterDate: dateFns.format(new Date(), "yyyy-MM-dd'T'HH"),
			fileNameToDate: (filename) => {
				const [date] = path.parse(filename).name.split('-')
				const m = dateRx.exec(date)
				if (m) {
					const [, year, month, day, hour] = m
					return `${year}-${month}-${day}T${hour}`
				}
				return dateFns.format(new Date(), "yyyy-MM-dd'T'HH") // No date found
			},
		}),
		dateToFileName: (date) => `${documentType}/hours/${date}-${v4()}.txt`,
	})
	// Concatenate days
	await concatenateFilesInBucket({
		files: await collectFilesInBucket({
			Prefix: `${documentType}/hours/`,
			notAfterDate: dateFns.format(new Date(), 'yyyy-MM-dd'),
			fileNameToDate: (filename) => {
				const [year, month, day] = path
					.parse(filename)
					.name.split('T')[0]
					.split('-')
				return `${year}-${month}-${day}`
			},
		}),
		dateToFileName: (date) => `${documentType}/days/${date}-${v4()}.txt`,
	})
	// Concatenate months
	await concatenateFilesInBucket({
		files: await collectFilesInBucket({
			Prefix: `${documentType}/days/`,
			notAfterDate: dateFns.format(new Date(), 'yyyy-MM-01'),
			fileNameToDate: (filename) => {
				const [year, month] = path.parse(filename).name.split('-')
				return `${year}-${month}-01`
			},
		}),
		dateToFileName: (date) => {
			const [year, month] = date.split('-')
			return `${documentType}/months/${year}-${month}-${v4()}.txt`
		},
	})
}
