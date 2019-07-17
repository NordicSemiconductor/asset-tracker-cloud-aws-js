const { Iot } = require('aws-sdk')
const response = require('cfn-response')
const iot = new Iot()
exports.handler = (event, context) => {
	const { RequestType, ResourceProperties: { ThingGroupName, ThingGroupProperties, PolicyName } } = event
	let p = Promise.resolve()
	switch (RequestType) {
		case 'Create':
			p = iot
				.createThingGroup({ thingGroupName: ThingGroupName, thingGroupProperties: ThingGroupProperties })
				.promise()
				.then(({ thingGroupArn }) => iot.attachPolicy({
					policyName: PolicyName,
					target: thingGroupArn,
				}).promise())
			break
	}
	p
		.then(() => {
			response.send(event, context, response.SUCCESS, { ThingGroupName }, false, ThingGroupName)
		})
		.catch(err => {
			response.send(event, context, response.FAILED, { Error: `${err.message}  (${err})` })
		})
}
