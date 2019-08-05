import { S3 } from 'aws-sdk'
import * as dateFns from 'date-fns'
import * as path from 'path'

const s3 = new S3()
const Bucket =
	process.env.HISTORICAL_DATA_BUCKET ||
	'bifravst-historicaldatabucket262e8e16-ugmlhvrfb6o0'

const collectFiles = async ({
	files,
	Marker,
	Prefix,
	notAfterDate,
	fileNameToDate,
}: {
	files?: { [key: string]: string[] }
	Marker?: string
	Prefix: string
	notAfterDate: string
	fileNameToDate: (filename: string) => string
}): Promise<{ [key: string]: string[] }> =>
	s3
		.listObjects({
			Bucket,
			Prefix,
			Marker,
		})
		.promise()
		.then(async ({ NextMarker, Contents }) => {
			const f = (Contents || [])
				.map(({ Key }) => Key as string)
				.reduce((files, file) => {
					const d = fileNameToDate(file)
					// Do not concatenate files in current range
					if (d >= notAfterDate) {
						return files
					}
					if (!files[d]) {
						files[d] = [file]
					} else {
						files[d].push(file)
					}
					return files
				}, files || {})
			if (NextMarker) {
				return collectFiles({
					files: f,
					Marker: NextMarker,
					Prefix,
					notAfterDate: notAfterDate,
					fileNameToDate,
				})
			}
			return f
		})

const concatenateFiles = async ({
	Prefix,
	notAfterDate,
	fileNameToDate,
	dateToFileName,
}: {
	Prefix: string
	notAfterDate: string
	fileNameToDate: (filename: string) => string
	dateToFileName: (date: string) => string
}) => {
	const files = await collectFiles({
		Prefix,
		notAfterDate,
		fileNameToDate,
	})
	await Object.entries(files).reduce(async (p, [date, files]) => {
		await p
		// Fetch all bodies
		const bodies = await Promise.all(
			files.map(async Key =>
				s3
					.getObject({
						Bucket,
						Key,
					})
					.promise()
					.then(({ Body }) => Body),
			),
		)
		// Store all bodies in one file for the day
		const dateFile = dateToFileName(date)
		await s3
			.putObject({
				Bucket,
				Key: dateFile,
				Body: bodies.map(b => b && b.toString()).join('\n'),
			})
			.promise()
		console.log(`${dateFile} written`)
		await s3
			.deleteObjects({
				Bucket,
				Delete: { Objects: files.map(Key => ({ Key })) },
			})
			.promise()
		console.log(`Deleted ${files.length} original files`)
	}, Promise.resolve())
}

const dateRx = new RegExp(/^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})/)

/**
 * This lambda runs every day and concatenates the raw message logs
 */
export const handler = async () => {
	// Concatenate hours
	await concatenateFiles({
		Prefix: 'raw/updates/',
		notAfterDate: dateFns.format(new Date(), 'YYYY-MM-DDTHH'),
		fileNameToDate: filename => {
			const [date] = path.parse(filename).name.split('-')
			const m = dateRx.exec(date)
			if (m) {
				const [, year, month, day, hour] = m
				return `${year}-${month}-${day}T${hour}`
			}
			return dateFns.format(new Date(), 'YYYY-MM-DDTHH') // No date found
		},
		dateToFileName: date => `hours/${date}.txt`,
	})
	// Concatenate days
	await concatenateFiles({
		Prefix: 'hours/',
		notAfterDate: dateFns.format(new Date(), 'YYYY-MM-DD'),
		fileNameToDate: filename => {
			const [year, month, day] = path
				.parse(filename)
				.name.split('T')[0]
				.split('-')
			return `${year}-${month}-${day}`
		},
		dateToFileName: date => `days/${date}.txt`,
	})
	// Concatenate months
	await concatenateFiles({
		Prefix: 'days/',
		notAfterDate: dateFns.format(new Date(), 'YYYY-MM-01'),
		fileNameToDate: filename => {
			const [year, month] = path.parse(filename).name.split('-')
			return `${year}-${month}-01`
		},
		dateToFileName: date => {
			const [year, month] = date.split('-')
			return `months/${year}-${month}.txt`
		},
	})
}

handler().catch(err => {
	console.error(err)
})
