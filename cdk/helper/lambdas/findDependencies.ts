import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts, { type ImportDeclaration, type StringLiteral } from 'typescript'

/**
 * Resolve project-level dependencies for the given file using TypeScript compiler API
 */
export const findDependencies = (
	sourceFile: string,
	imports: string[] = [],
	visited: string[] = [],
): string[] => {
	if (visited.includes(sourceFile)) return imports

	const fileNode = ts.createSourceFile(
		sourceFile,
		readFileSync(sourceFile, 'utf-8').toString(),
		ts.ScriptTarget.ES2022,
		/*setParentNodes */ true,
	)

	const parseChild = (node: ts.Node) => {
		if (node.kind !== ts.SyntaxKind.ImportDeclaration) return
		const moduleSpecifier = (
			(node as ImportDeclaration).moduleSpecifier as StringLiteral
		).text
		const file = moduleSpecifier.startsWith('.')
			? path
					.resolve(path.parse(sourceFile).dir, moduleSpecifier)
					// In ECMA Script modules, all imports from local files must have an extension.
					// See https://nodejs.org/api/esm.html#mandatory-file-extensions
					// So we need to replace the `.js` in the import specification to find the TypeScript source for the file.
					// Example: import { Network, notifyClients } from './notifyClients.js'
					// The source file for that is actually in './notifyClients.ts'
					.replace(/\.js$/, '.ts')
			: moduleSpecifier
		try {
			const s = statSync(file)
			if (!s.isDirectory()) imports.push(file)
		} catch {
			// Module or file not found
			visited.push(file)
		}
	}
	ts.forEachChild(fileNode, parseChild)
	visited.push(sourceFile)

	for (const file of imports) {
		findDependencies(file, imports, visited)
	}

	return imports
}
