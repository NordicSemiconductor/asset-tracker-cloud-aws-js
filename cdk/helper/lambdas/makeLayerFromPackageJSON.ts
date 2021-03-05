import * as path from 'path'
import { promises as fs } from 'fs'
import { packBaseLayer } from '@nordicsemiconductor/package-layered-lambdas'
import { ProgressReporter } from '@nordicsemiconductor/package-layered-lambdas/dist/src/reporter'

/**
 * Creates a layer by selecting dependencies from the provided package.json.
 * Should not be used for production lambdas.
 */
export const makeLayerFromPackageJSON__Unsafe = async ({
	dir,
	packageJson,
	requiredDependencies,
	reporter,
	sourceCodeBucketName,
	outDir,
	layerName,
}: {
	dir: string
	requiredDependencies: string[]
	packageJson: string
	reporter: ProgressReporter
	sourceCodeBucketName: string
	outDir: string
	layerName: string
}): Promise<string> => {
	const { dependencies } = JSON.parse(await fs.readFile(packageJson, 'utf-8'))

	try {
		await fs.stat(dir)
		reporter.progress('base-layer')(`${dir} exists`)
	} catch (_) {
		reporter.progress('base-layer')(`Creating ${dir} ...`)
		await fs.mkdir(dir)
	}

	const deps = requiredDependencies.reduce((resolved, dep) => {
		if (dependencies[dep] === undefined)
			throw new Error(
				`Could not resolve dependency "${dep}" in ${packageJson}`!,
			)
		reporter.progress('base-layer')(`${dep}: ${dependencies[dep]}`)
		return {
			...resolved,
			[dep]: dependencies[dep],
		}
	}, {} as Record<string, string>)

	reporter.progress('base-layer')('Writing package.json ...')
	await fs.writeFile(
		path.join(dir, 'package.json'),
		JSON.stringify({
			dependencies: deps,
		}),
		'utf-8',
	)

	return packBaseLayer({
		layerName,
		reporter,
		srcDir: dir,
		outDir,
		Bucket: sourceCodeBucketName,
		// See https://github.com/aws/aws-sdk-js-v3/issues/2051
		installCommand: [
			'npx',
			'--yes',
			'npm@6',
			// No lockfile, so do not use 'ci'
			'i',
			'--no-audit',
			'--ignore-scripts',
			'--only=prod',
		],
	})
}
