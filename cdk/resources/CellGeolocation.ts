import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as StepFunctions from '@aws-cdk/aws-stepfunctions';

/**
 * Provides the resources for geolocating LTE/NB-IoT network cells
 */
export class CellGeolocation extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
	) {
		super(parent, id)

		const stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			definition: new StepFunctions.Pass(parent, `Done`, {
				result: StepFunctions.Result.fromBoolean(true),
				resultPath: '$.result',
			}),
			timeout: CloudFormation.Duration.minutes(5)
		})

		const topicRuleRole = new IAM.Role(this, 'Role', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				iot: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${parent.region}:${parent.account}:topic/errors`,
							],
						}),
					],
				}),
				stepFunctions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['states:StartExecution'],
							resources: [
								stateMachine.stateMachineArn
							]
						})
					]
				})
			},
		})

		new IoT.CfnTopicRule(this, 'resolveCellIds', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Executes a step function which will geolocate the cell location provided by the device',
				ruleDisabled: false,
				// Note: this timestamp is formatted for the AWS Athena TIMESTAMP datatype
				sql:
					`SELECT current.state.reported.roam.v AS roaming, clientid() as deviceId 
					FROM '$aws/things/+/shadow/documents' 
					WHERE current.state.reported.roam.v.cell <> NULL 
					AND current.state.reported.roam.v.mccmnc <> NULL 
					AND current.state.reported.roam.v.area <> NULL` +
					// Only trigger if the reported cell changed
					` AND previous.state.reported.roam.v.cell <> current.state.reported.roam.v.cell` +
					// Only trigger if the current geolocation in the state is not for the new cell
					// it might not have been updated yet
					` AND current.state.desired.celgeo.v.cell <> current.state.reported.roam.v.cell`,
				actions: [
					{
						stepFunctions: {
							stateMachineName: stateMachine.stateMachineName,
							roleArn: topicRuleRole.roleArn,
						}
					},
				],
				errorAction: {
					republish: {
						roleArn: topicRuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})
	}
}
