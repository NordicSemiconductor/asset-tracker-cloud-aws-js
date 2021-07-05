import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'

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

		const LOCATIONS_TABLE_CELLID_INDEX =
			'cellIdIndex-720633fc-5dec-4b39-972a-b4347188d69b'

		this.deviceCellGeolocationTable.addGlobalSecondaryIndex({
			indexName: LOCATIONS_TABLE_CELLID_INDEX,
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

		new IoT.CfnTopicRule(this, `storeCellGeolocationsFromDevicesroam`, {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: `Stores the geolocations for cells from devices (with nw in roam)`,
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
					'current.state.reported.gps.v.lat AS lat,',
					'current.state.reported.gps.v.lng AS lng,',
					'current.state.reported.gps.v.acc AS accuracy,',
					'concat("device:", topic(3)) as source,',
					"parse_time(\"yyyy-MM-dd'T'HH:mm:ss.S'Z'\", timestamp()) as timestamp",
					`FROM '$aws/things/+/shadow/update/documents'`,
					'WHERE',
					// only if it actually has roaming information
					'isUndefined(current.state.reported.roam.v.area) = false',
					'AND isUndefined(current.state.reported.roam.v.mccmnc) = false',
					'AND isUndefined(current.state.reported.roam.v.cell) = false',
					`AND isUndefined(current.state.reported.roam.v.nw) = false`,
					// and if it has GPS location
					'AND isUndefined(current.state.reported.gps.v.lat) = false AND current.state.reported.gps.v.lat <> 0',
					'AND isUndefined(current.state.reported.gps.v.lng) = false AND current.state.reported.gps.v.lng <> 0',
					// only if the location has changed
					'AND (',
					'isUndefined(previous.state.reported.gps.v.lat)',
					'OR',
					'previous.state.reported.gps.v.lat <> current.state.reported.gps.v.lat',
					'OR',
					'isUndefined(previous.state.reported.gps.v.lng)',
					'OR',
					'previous.state.reported.gps.v.lng <> current.state.reported.gps.v.lng',
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
