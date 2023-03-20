import CloudFormation from 'aws-cdk-lib'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import IAM from 'aws-cdk-lib/aws-iam'
import IoT from 'aws-cdk-lib/aws-iot'

/**
 * Store Cell Geolocation from Devices.
 *
 * This can be used to calculate the cell geolocation for cells that can't be
 * resolved using a third-party provider.
 *
 * @see https://nordicsemiconductor.github.io/asset-tracker-cloud-docs/saga/docs/guides/CellGeolocations.html#geolocating-cells-using-other-devices
 */
export class DeviceCellGeolocations extends CloudFormation.Resource {
	public readonly deviceCellGeolocationTable: DynamoDB.Table
	public readonly deviceCellGeolocationTableCellIdIndex: string =
		'cellIdIndex-720633fc-5dec-4b39-972a-b4347188d69b'

	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		this.deviceCellGeolocationTable = new DynamoDB.Table(
			this,
			'deviceCellGeoLocation',
			{
				billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
				partitionKey: {
					name: 'uuid',
					type: DynamoDB.AttributeType.STRING,
				},
				sortKey: {
					name: 'timestamp',
					type: DynamoDB.AttributeType.STRING,
				},
				pointInTimeRecovery: true,
				removalPolicy:
					this.node.tryGetContext('isTest') === true
						? CloudFormation.RemovalPolicy.DESTROY
						: CloudFormation.RemovalPolicy.RETAIN,
			},
		)

		this.deviceCellGeolocationTable.addGlobalSecondaryIndex({
			indexName: this.deviceCellGeolocationTableCellIdIndex,
			partitionKey: {
				name: 'cellId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.INCLUDE,
			nonKeyAttributes: ['lat', 'lng', 'accuracy'],
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
				dynamodb: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['dynamodb:PutItem'],
							resources: [this.deviceCellGeolocationTable.tableArn],
						}),
					],
				}),
			},
		})

		new IoT.CfnTopicRule(this, `storeCellGeolocationsFromDevices`, {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: `Stores the geolocations for cells from devices`,
				ruleDisabled: false,
				sql: [
					'SELECT',
					'newuuid() as uuid,',
					'current.state.reported.roam.v.cell as cell,',
					`current.state.reported.roam.v.nw as nw,`,
					'current.state.reported.roam.v.mccmnc as mccmnc,',
					'current.state.reported.roam.v.area as area,',
					// see cellId in @nordicsemiconductor/cell-geolocation-helpers for format of cellId
					'concat(',
					`CASE startswith(current.state.reported.roam.v.nw, "NB-IoT") WHEN true THEN "nbiot" ELSE "ltem" END,`,
					'"-",',
					'current.state.reported.roam.v.cell,',
					'"-",',
					'current.state.reported.roam.v.mccmnc,',
					'"-",',
					'current.state.reported.roam.v.area',
					') AS cellId,',
					'current.state.reported.gnss.v.lat AS lat,',
					'current.state.reported.gnss.v.lng AS lng,',
					'current.state.reported.gnss.v.acc AS accuracy,',
					'concat("device:", topic(3)) as source,',
					"parse_time(\"yyyy-MM-dd'T'HH:mm:ss.S'Z'\", timestamp()) as timestamp",
					`FROM '$aws/things/+/shadow/update/documents'`,
					'WHERE',
					// only if it actually has roaming information
					'isUndefined(current.state.reported.roam.v.area) = false',
					'AND isUndefined(current.state.reported.roam.v.mccmnc) = false',
					'AND isUndefined(current.state.reported.roam.v.cell) = false',
					`AND isUndefined(current.state.reported.roam.v.nw) = false`,
					// and if it has GNSS location
					'AND isUndefined(current.state.reported.gnss.v.lat) = false AND current.state.reported.gnss.v.lat <> 0',
					'AND isUndefined(current.state.reported.gnss.v.lng) = false AND current.state.reported.gnss.v.lng <> 0',
					// only if the location has changed
					'AND (',
					'isUndefined(previous.state.reported.gnss.v.lat)',
					'OR',
					'previous.state.reported.gnss.v.lat <> current.state.reported.gnss.v.lat',
					'OR',
					'isUndefined(previous.state.reported.gnss.v.lng)',
					'OR',
					'previous.state.reported.gnss.v.lng <> current.state.reported.gnss.v.lng',
					')',
				].join(' '),
				actions: [
					{
						dynamoDBv2: {
							putItem: {
								tableName: this.deviceCellGeolocationTable.tableName,
							},
							roleArn: topicRuleRole.roleArn,
						},
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
