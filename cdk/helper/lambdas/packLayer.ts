import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import { ZipFile } from 'yazl'

export type PackedLayer = { layerZipFile: string }

export const packLayer = async ({
	id,
	dependencies,
}: {
	id: string
	dependencies: string[]
}): Promise<PackedLayer> => {
	const packageJsonFile = path.join(process.cwd(), 'package.json')
	const packageLockJsonFile = path.join(process.cwd(), 'package-lock.json')
	const { dependencies: deps, devDependencies: devDeps } = JSON.parse(
		await readFile(packageJsonFile, 'utf-8'),
	)

	const layerDir = path.join(process.cwd(), 'dist', 'layers', id)
	const nodejsDir = path.join(layerDir, 'nodejs')

	try {
		await rm(layerDir, { recursive: true })
	} catch {
		// Folder does not exist.
	}

	await mkdir(nodejsDir, { recursive: true })

	const depsToBeInstalled = dependencies.reduce(
		(resolved, dep) => {
			const resolvedDependency = deps[dep] ?? devDeps[dep]
			if (resolvedDependency === undefined)
				throw new Error(
					`Could not resolve dependency "${dep}" in ${packageJsonFile}!`,
				)
			return {
				...resolved,
				[dep]: resolvedDependency,
			}
		},
		{} as Record<string, string>,
	)

	await writeFile(
		path.join(nodejsDir, 'package.json'),
		JSON.stringify({
			dependencies: depsToBeInstalled,
		}),
		'utf-8',
	)
	await copyFile(packageLockJsonFile, path.join(nodejsDir, 'package-lock.json'))

	await new Promise<void>((resolve, reject) => {
		const [cmd, ...args] = [
			'npm',
			'ci',
			'--ignore-scripts',
			'--only=prod',
			'--no-audit',
		]
		const p = spawn(cmd, args, {
			cwd: nodejsDir,
		})
		p.on('close', (code) => {
			if (code !== 0) {
				const msg = `${cmd} ${args.join(
					' ',
				)} in ${nodejsDir} exited with code ${code}.`
				return reject(new Error(msg))
			}
			return resolve()
		})
	})

	const filesToAdd = await glob(`**`, {
		cwd: layerDir,
		nodir: true,
	})
	const zipfile = new ZipFile()
	filesToAdd.forEach((f) => {
		zipfile.addFile(path.join(layerDir, f), f)
	})

	const zipFileName = await new Promise<string>((resolve) => {
		const zipFileName = path.join(process.cwd(), 'dist', 'layers', `${id}.zip`)
		zipfile.outputStream
			.pipe(createWriteStream(zipFileName))
			.on('close', () => {
				resolve(zipFileName)
			})
		zipfile.end()
	})

	return {
		layerZipFile: zipFileName,
	}
}
