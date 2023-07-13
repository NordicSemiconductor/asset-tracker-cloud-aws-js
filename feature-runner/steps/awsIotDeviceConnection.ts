import { device } from 'aws-iot-device-sdk'
import { promises as fs } from 'fs'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations.js'
import { isNullOrUndefined } from '../../util/isNullOrUndefined.js'

export type Listener = () => unknown
export type ListenerWithPayload = (payload: Buffer) => unknown
export type Connection = {
	onConnect: (listener: Listener) => void
	onMessageOnce: (topic: string, listener: ListenerWithPayload) => Promise<void>
	publish: (topic: string, message: string) => Promise<void>
	close: () => void
}

export const awsIotDeviceConnection = ({
	mqttEndpoint,
	certsDir,
	awsIotRootCA,
}: {
	mqttEndpoint: string
	certsDir: string
	awsIotRootCA: string
}): ((clientId: string) => Promise<Connection>) => {
	const connections: Record<string, Connection> = {}
	const credentials: Record<string, Promise<[string, string]>> = {}

	return async (clientId) => {
		const onConnectListeners: Listener[] = []
		const onMessageOnceListeners: Record<string, ListenerWithPayload[]> = {}
		if (connections[clientId] === undefined) {
			let connected = false
			let connectedTimeout: NodeJS.Timeout
			const deviceFiles = deviceFileLocations({
				certsDir,
				deviceId: clientId,
			})
			if (credentials[clientId] === undefined) {
				credentials[clientId] = Promise.all([
					fs.readFile(deviceFiles.key, 'utf-8'),
					fs.readFile(deviceFiles.certWithCA, 'utf-8'),
				])
			}
			const [privateKey, clientCert] = (await credentials[clientId]) as [
				string,
				string,
			]
			const d = new device({
				privateKey: Buffer.from(privateKey),
				clientCert: Buffer.from(clientCert),
				caCert: Buffer.from(awsIotRootCA),
				clientId,
				host: mqttEndpoint,
				region: mqttEndpoint.split('.')[2],
			})
			d.on('connect', () => {
				connected = true
				connectedTimeout = setTimeout(() => {
					if (connected) onConnectListeners.forEach((fn) => fn())
				}, 1000)
			})
			d.on('close', () => {
				connected = false
				clearTimeout(connectedTimeout)
			})
			d.on('message', (topic, payload) => {
				d.unsubscribe(topic)
				onMessageOnceListeners[topic]?.forEach((fn) => fn(payload))
				onMessageOnceListeners[topic] = []
			})
			connections[clientId] = {
				onConnect: (listener) => {
					onConnectListeners.push(listener)
				},
				publish: async (topic, message) =>
					new Promise<void>((resolve, reject) => {
						d.publish(
							topic,
							message,
							{
								qos: 1,
							},
							(error) => {
								if (isNullOrUndefined(error)) return resolve()
								return reject(error)
							},
						)
					}),
				onMessageOnce: async (topic, listener) =>
					new Promise((resolve, reject) => {
						d.subscribe(
							topic,
							{
								qos: 1,
							},
							(error) => {
								if (isNullOrUndefined(error)) return resolve()
								return reject(error)
							},
						)
						onMessageOnceListeners[topic] = [
							...(onMessageOnceListeners[topic] ?? []),
							listener,
						]
					}),
				close: () => {
					d.end()
					delete connections[clientId]
				},
			}
		}
		return connections[clientId] as Connection
	}
}
