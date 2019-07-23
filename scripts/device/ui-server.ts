import * as http from 'http'
import chalk from 'chalk'
import { portForDevice } from './portForDevice'

export const uiServer = async (args: {
	deviceId: string
	deviceUiUrl: string
	onUpdate: (update: object) => void
}) => {
	const port = portForDevice({ deviceId: args.deviceId })

	const requestHandler: http.RequestListener = async (request, response) => {
		if (request.method === 'OPTIONS') {
			response.writeHead(200, {
				'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Access-Control-Allow-Origin': '*',
			})
			response.end()
			return
		}
		let body = ''
		switch (request.url) {
			case '/id':
				response.writeHead(200, {
					'Content-Length': args.deviceId.length,
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': '*',
				})
				response.end(args.deviceId)
				break
			case '/update':
				request.on('data', chunk => {
					body += chunk.toString() // convert Buffer to string
				})
				request.on('end', () => {
					try {
						console.log(body)
						const update = JSON.parse(body)
						args.onUpdate(update)
						response.writeHead(202, {
							'Access-Control-Allow-Origin': '*',
						})
						response.end()
					} catch (err) {
						console.log(err)
						const errData = JSON.stringify(err)
						response.writeHead(400, {
							'Content-Length': Buffer.byteLength(errData),
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						})
						response.end(errData)
					}
				})
				break
			case '/subscribe':
				// FIXME: Add websockets
				break
			default:
				response.statusCode = 404
				response.end()
		}
	}

	const server = http.createServer(requestHandler)

	server.listen(port, () => {
		console.log(
			chalk.cyan(`To control this device open your browser on:`),
			chalk.green(
				`${args.deviceUiUrl}?endpoint=${encodeURIComponent(
					`http://localhost:${port}`,
				)}`,
			),
		)
	})
}
