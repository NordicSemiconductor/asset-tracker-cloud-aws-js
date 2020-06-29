import { Iot } from 'aws-sdk'

export const getIotEndpoint = async (iot: Iot): Promise<string> =>
	iot
		.describeEndpoint({ endpointType: 'iot:Data-ATS' })
		.promise()
		.then(({ endpointAddress }) => {
			if (endpointAddress === undefined) {
				throw new Error(`Failed to resolved AWS IoT endpoint`)
			}
			return endpointAddress
		})
