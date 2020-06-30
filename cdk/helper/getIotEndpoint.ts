import { Iot } from 'aws-sdk'
import { isNullOrUndefined } from 'util'

export const getIotEndpoint = async (iot: Iot): Promise<string> =>
	iot
		.describeEndpoint({ endpointType: 'iot:Data-ATS' })
		.promise()
		.then(({ endpointAddress }) => {
			if (isNullOrUndefined(endpointAddress)) {
				throw new Error(`Failed to resolved AWS IoT endpoint`)
			}
			return endpointAddress
		})
