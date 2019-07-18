import * as path from 'path'
import * as http from 'http'
import { promises as fs } from 'fs'
import chalk from 'chalk'

export const uiServer = async (args: {
	onUpdate: (update: object) => void
}) => {
	const port = 1024 + Math.round(Math.random() * (65535 - 1024))
	const uiPage = await fs.readFile(
		path.resolve(process.cwd(), 'data', 'device-ui.html'),
		'utf-8',
	)

	const requestHandler: http.RequestListener = async (request, response) => {
		let body = ''
		switch (request.url) {
			case '/':
			case '/index.html':
				response.writeHead(200, {
					'Content-Length': Buffer.byteLength(uiPage),
					'Content-Type': 'text/html',
				})
				response.end(uiPage)
				break
			case '/update':
				request.on('data', chunk => {
					body += chunk.toString() // convert Buffer to string
				})
				request.on('end', () => {
					try {
						const update = JSON.parse(body)
						args.onUpdate(update)
						response.statusCode = 202
						response.end()
					} catch (err) {
						console.log(err)
						const errData = JSON.stringify(err)
						response.writeHead(400, {
							'Content-Length': Buffer.byteLength(errData),
							'Content-Type': 'application/json',
						})
						response.end(errData)
					}
				})
				break
			default:
				response.statusCode = 404
				response.end()
		}
	}

	const server = http.createServer(requestHandler)

	server.listen(port, () => {
		console.log(
			chalk.green(
				`To control this device open your browser on http://localhost:${port}`,
			),
		)
	})
}
