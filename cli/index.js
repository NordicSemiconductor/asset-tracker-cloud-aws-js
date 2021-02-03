#!/usr/bin/env node

const die = (err, origin) => {
	console.error(`An unhandled exception occured!`)
	console.error(`Exception origin: ${JSON.stringify(origin)}`)
	console.error(err)
	process.exit(1)
}

process.on('uncaughtException', die)
process.on('unhandledRejection', die)

// eslint-disable-next-line
require('../dist/cli/cli')
