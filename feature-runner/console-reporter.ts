import { consoleReporter } from '@nordicsemiconductor/bdd-markdown'

const chunks: string[] = []

process.stdin.on('data', (data) => {
	chunks.push(data.toString())
})

process.stdin.on('end', () => {
	consoleReporter(JSON.parse(chunks.join('')), console.log)
})
