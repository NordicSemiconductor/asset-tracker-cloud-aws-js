import * as path from 'path'
import { promises as fs } from 'fs'
import { packBaseLayer } from '@nordicsemiconductor/package-layered-lambdas'
import { ProgressReporter } from '@nordicsemiconductor/package-layered-lambdas/dist/src/reporter'

/**
 * Creates a layer by selecting dependencies from the provided package.json.
 */
export const makeLayerFromPackageJSON = async ({
	dir,
	packageJsonFile,
	packageLockJsonFile,
	requiredDependencies,
	reporter,
	sourceCodeBucketName,
	outDir,
	layerName,
}: {
	dir: string
	requiredDependencies: string[]
	packageJsonFile: string
	packageLockJsonFile: string
	reporter: ProgressReporter
	sourceCodeBucketName: string
	outDir: string
	layerName: string
}): Promise<string> => {
	const { dependencies } = JSON.parse(
		await fs.readFile(packageJsonFile, 'utf-8'),
	)

	try {
		await fs.stat(dir)
		reporter.progress(layerName)(`${dir} exists`)
	} catch (_) {
		reporter.progress(layerName)(`Creating ${dir} ...`)
		await fs.mkdir(dir)
	}

	const deps = requiredDependencies.reduce((resolved, dep) => {
		if (dependencies[dep] === undefined)
			throw new Error(
				`Could not resolve dependency "${dep}" in ${packageJsonFile}`!,
			)
		reporter.progress(layerName)(`${dep}: ${dependencies[dep]}`)
		return {
			...resolved,
			[dep]: dependencies[dep],
		}
	}, {} as Record<string, string>)

	reporter.progress(layerName)('Writing package.json ...')
	await fs.writeFile(
		path.join(dir, 'package.json'),
		JSON.stringify({
			dependencies: deps,
		}),
		'utf-8',
	)
	reporter.progress(layerName)('Copying package-lock.json ...')
	await fs.copyFile(packageLockJsonFile, path.join(dir, 'package-lock.json'))
	return packBaseLayer({
		layerName,
		reporter,
		srcDir: dir,
		outDir,
		Bucket: sourceCodeBucketName,
	})
}
