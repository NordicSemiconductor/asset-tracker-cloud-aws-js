var chalk = require('chalk')
var path = require('path')
var pjson = require(path.resolve(process.cwd(), 'package.json'))
var compareVersions = require('compare-versions')

if (
	!compareVersions.compare(
		process.version.substr(1),
		pjson.engines.node.replace(/[^0-9.]/g, ''),
		pjson.engines.node.replace(/[0-9.]/g, ''),
	)
) {
	console.log()
	console.log(
		chalk.yellow.inverse.bold(' WARNING '),
		chalk.yellow(`Your Node.js version ${chalk.red(process.version)} is not supported!`),
	)
	console.log(
		chalk.yellow.inverse.bold(' WARNING '),
		chalk.yellow(`Required Node.js version: ${pjson.engines.node}`),
	)
	console.log()
	process.exit(1)
} else {
	console.log()
	console.log(
		chalk.green(
			`Found supported Node.js version ${chalk.blue(process.version)}`,
		),
	)
	console.log()
}
