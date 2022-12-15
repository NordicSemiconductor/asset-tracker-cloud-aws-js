import * as path from 'path'

export const caFileLocations = ({
	id,
	certsDir,
}: {
	id: string
	certsDir: string
}): {
	cert: string
	key: string
} => ({
	cert: path.resolve(certsDir, `${id}.pem`),
	key: path.resolve(certsDir, `${id}.key`),
})
