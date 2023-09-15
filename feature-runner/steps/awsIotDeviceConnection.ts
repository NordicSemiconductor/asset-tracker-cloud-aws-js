import { device } from 'aws-iot-device-sdk'
import { promises as fs } from 'fs'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations.js'
import { isNullOrUndefined } from '../../util/isNullOrUndefined.js'

export type Listener = () => void
export type MessageListener = (topic: string, message: Buffer) => void
export type Connection = {
	onConnect: (listener: Listener) => void
	onDisconnect: (listener: Listener) => void
	onMessage: (listener: MessageListener) => void
	offMessage: (listener: MessageListener) => void
	publish: (topic: string, message: string) => Promise<void>
	close: () => void
	subscribe: (topic: string) => void
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
		const onDisconnectListeners: Listener[] = []
		let onMessageListeners: MessageListener[] = []
		const messages: Record<string, any[]> = {}
		if (connections[clientId] === undefined) {
			connections[clientId] = await new Promise<Connection>(
				(resolve, reject) => {
					let connected: boolean | undefined = undefined
					const connectedTimeout = setTimeout(
						() => reject(new Error(`Timed out connecting ${clientId}`)),
						60 * 1000,
					)

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

					void credentials[clientId]
						?.then(([privateKey, clientCert]) => {
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
								onConnectListeners.forEach((fn) => fn())
								resolve({
									onConnect: (listener) => {
										onConnectListeners.push(listener)
										// Notify about connection
										if (connected === true) {
											listener()
										}
									},
									onDisconnect: (listener) => {
										onDisconnectListeners.push(listener)
										// Notify about connection
										if (connected === false) {
											listener()
										}
									},
									onMessage: (listener) => {
										onMessageListeners.push(listener)
										// Notify about older messages
										for (const [topic, m] of Object.entries(messages)) {
											for (const listener of onMessageListeners) {
												for (const message of m) {
													listener(topic, message)
												}
											}
										}
									},
									offMessage: (listener) => {
										const idx = onMessageListeners.indexOf(listener)
										if (idx < 0) return
										onMessageListeners = [
											...onMessageListeners.slice(0, idx),
											...onMessageListeners.slice(idx + 1),
										]
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
									close: () => {
										d.end()
										delete connections[clientId]
									},
									subscribe: (topic: string) => {
										d.subscribe(topic)
									},
								})
							})
							d.on('close', () => {
								connected = false
								onDisconnectListeners.forEach((fn) => fn())
								clearTimeout(connectedTimeout)
							})
							d.on('message', (topic, payload) => {
								messages[topic] = [...(messages[topic] ?? []), payload]
								onMessageListeners.map((listener) => listener(topic, payload))
							})
						})
						.catch((err) => reject(err))
				},
			)
		}
		return connections[clientId] as Connection
	}
}
