import { BifravstApp } from './BifravstApp'
import { Iot } from 'aws-sdk'

const STACK_ID = process.env.STACK_ID || 'bifravst'

const main = async () => {
	const { endpointAddress } = await new Iot({
		region: process.env.AWS_DEFAULT_REGION,
	})
		.describeEndpoint({ endpointType: 'iot:Data-ATS' })
		.promise()

	if (!endpointAddress) {
		throw new Error(`Failed to resolved AWS IoT endpoint`)
	}

	new BifravstApp({
		stackId: STACK_ID,
		mqttEndpoint: endpointAddress,
	}).synth()
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
