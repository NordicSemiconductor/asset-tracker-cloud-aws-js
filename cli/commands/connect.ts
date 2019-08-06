import { ComandDefinition } from './CommandDefinition'
import * as path from 'path'
import { connect } from '../device/connect'

export const connectCommand = ({
	endpoint,
	deviceUiUrl,
	certsDir,
}: {
	endpoint: string
	deviceUiUrl: string
	certsDir: string
}): ComandDefinition => ({
	command: 'connect <deviceId>',
	options: [
		{
			flags: '-e, --endpoint <endpoint>',
			description: 'MQTT broker endpoint',
		},
	],
	action: async (deviceId: string) =>
		connect({
			deviceId,
			deviceUiUrl,
			endpoint,
			certsDir,
			caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		}),
	help: 'Connect to the AWS IoT broker using a generated device certificate.',
})
