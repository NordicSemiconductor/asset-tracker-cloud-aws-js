import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

export const getCurrentCA = ({ certsDir }: { certsDir: string }): string => {
	try {
		return readFileSync(path.join(certsDir, 'currentCA'), 'utf-8')
	} catch (error) {
		throw new Error(
			`Could not determine current CA: ${(error as Error).message}`,
		)
	}
}

export const setCurrentCA = ({
	certsDir,
	caId,
}: {
	certsDir: string
	caId: string
}): void => {
	writeFileSync(path.join(certsDir, 'currentCA'), caId, 'utf-8')
}
