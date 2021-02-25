import * as path from 'path'
import { promises as fs } from 'fs'
import { packBaseLayer } from '@nordicsemiconductor/package-layered-lambdas'
import { spawn } from 'child_process'
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
}: {
	dir: string
	requiredDependencies: string[]
	packageJson: string
	reporter: ProgressReporter
	sourceCodeBucketName: string
	outDir: string
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

	reporter.progress('base-layer')('Installing dependencies ...')
	await new Promise<void>((resolve, reject) => {
		const p = spawn('npm', ['i', '--ignore-scripts', '--only=prod'], {
			cwd: dir,
		})
		p.on('close', (code) => {
			if (code !== 0) {
				const msg = `[CloudFormation Layer] npm i in ${dir} exited with code ${code}.`
				return reject(new Error(msg))
			}
			return resolve()
		})
	})
	return packBaseLayer({
		reporter,
		srcDir: dir,
		outDir,
		Bucket: sourceCodeBucketName,
	})
}
