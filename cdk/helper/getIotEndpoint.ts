import { DescribeEndpointCommand, IoTClient } from '@aws-sdk/client-iot'

export const getIotEndpoint = async (iot: IoTClient): Promise<string> =>
	iot
		.send(new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' }))
		.then(({ endpointAddress }) => {
			if (endpointAddress === null || endpointAddress === undefined) {
				throw new Error(`Failed to resolved AWS IoT endpoint`)
			}
			return endpointAddress
		})
