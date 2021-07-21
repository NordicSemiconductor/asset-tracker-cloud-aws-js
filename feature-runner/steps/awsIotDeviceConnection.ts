import { device } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import { isNullOrUndefined } from '../../util/isNullOrUndefined'
import { readFileSync } from 'fs'

export type Listener = () => unknown
export type ListenerWithPayload = (payload: Buffer) => unknown
type Connection = {
	onConnect: (listener: Listener) => void
	onMessageOnce: (topic: string, listener: ListenerWithPayload) => Promise<void>
	publish: (topic: string, message: string) => Promise<void>
}

export const awsIotDeviceConnection = ({
	mqttEndpoint,
	certsDir,
	awsIotRootCA,
}: {
	mqttEndpoint: string
	certsDir: string
	awsIotRootCA: string
}): ((clientId: string) => Connection) => {
	const connections: Record<string, Connection> = {}

	return (clientId) => {
		const onConnectListeners: Listener[] = []
		const onMessageOnceListeners: Record<string, ListenerWithPayload[]> = {}
		if (connections[clientId] === undefined) {
			let connected = false
			let connectedTimeout: NodeJS.Timeout
			const deviceFiles = deviceFileLocations({
				certsDir,
				deviceId: clientId,
			})
			const { privateKey, clientCert } = JSON.parse(
				readFileSync(deviceFiles.json, 'utf-8'),
			)
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
						d.publish(topic, message, undefined, (error) => {
							if (isNullOrUndefined(error)) return resolve()
							return reject(error)
						})
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
			}
		}
		return connections[clientId]
	}
}
