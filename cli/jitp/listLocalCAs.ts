import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { fingerprint } from './fingerprint'

export const listLocalCAs = async ({
	certsDir,
}: {
	certsDir: string
}): Promise<Record<string, string>> => {
	const certs = (await readdir(certsDir)).filter((s) => s.endsWith('CA.pem'))
	const localCAs: Record<string, string> = {}

	for (const filename of certs) {
		localCAs[
			fingerprint(await readFile(path.join(certsDir, filename), 'utf-8'))
		] = filename
	}

	return localCAs
}
