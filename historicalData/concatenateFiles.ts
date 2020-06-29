import { S3 } from 'aws-sdk'

export type ConcatenateFilesArgs = {
	files: { [key: string]: string[] }
	dateToFileName: (date: string) => string
}
export type ConcatenateFilesResult = Promise<void>

export type ConcatenateFilesFn = (
	args: ConcatenateFilesArgs,
) => ConcatenateFilesResult

export const concatenateFiles = ({
	Bucket,
	s3,
}: {
	Bucket: string
	s3: S3
}) => async ({
	dateToFileName,
	files,
}: ConcatenateFilesArgs): ConcatenateFilesResult =>
	Object.entries(files).reduce(async (p, [date, files]) => {
		await p
		// Fetch all bodies
		console.log(`Fetching all bodies`, files)
		const bodies = await Promise.all(
			files.map(async (Key) =>
				s3
					.getObject({
						Bucket,
						Key,
					})
					.promise()
					.then(({ Body }) => Body),
			),
		)
		// Store all bodies in one file for the time span
		const dateFile = dateToFileName(date)
		console.log(`Writing ${dateFile} ...`)
		await s3
			.putObject({
				Bucket,
				Key: dateFile,
				Body: bodies.map((b) => b?.toString() ?? '').join('\n'),
			})
			.promise()
		console.log(`${dateFile} written`)
		console.log(`Deleting originals`, files)
		await s3
			.deleteObjects({
				Bucket,
				Delete: { Objects: files.map((Key) => ({ Key })) },
			})
			.promise()
		console.log(`Deleted ${files.length} original files`)
	}, Promise.resolve())
