import { S3 } from 'aws-sdk'

export type CollectFilesArgs = {
	Prefix: string
	notAfterDate: string
	fileNameToDate: (filename: string) => string
}

export type CollectFilesResult = Promise<{ [key: string]: string[] }>

export type CollectFilesFn = (args: CollectFilesArgs) => CollectFilesResult

export const collectFiles = ({
	Bucket,
	s3,
}: {
	Bucket: string
	s3: S3
}) => async ({
	files,
	Marker,
	Prefix,
	notAfterDate,
	fileNameToDate,
}: {
	files?: { [key: string]: string[] }
	Marker?: string
} & CollectFilesArgs): CollectFilesResult =>
	s3
		.listObjects({
			Bucket,
			Prefix,
			Marker,
		})
		.promise()
		.then(async ({ NextMarker, Contents }) => {
			const f = (Contents ?? [])
				.map(({ Key }) => Key as string)
				.reduce((files, file) => {
					const d = fileNameToDate(file)
					// Do not concatenate files in current range
					if (d >= notAfterDate) {
						return files
					}
					if (files[d] === undefined) {
						files[d] = [file]
					} else {
						files[d].push(file)
					}
					return files
				}, files ?? {})
			if (NextMarker !== undefined) {
				return collectFiles({ Bucket, s3 })({
					files: f,
					Marker: NextMarker,
					Prefix,
					notAfterDate: notAfterDate,
					fileNameToDate,
				})
			}
			return f
		})
