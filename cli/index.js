#!/usr/bin/env node

process.on('uncaughtException', (err, origin) => {
	process.exitCode = 1
	console.error(`An unhandled exception occured!`)
	console.error(`Exception origin: ${origin}`)
	console.error(err)
})

// eslint-disable-next-line
require('../dist/cli/bifravst')
