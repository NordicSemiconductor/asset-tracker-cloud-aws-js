import * as CloudFormation from '@aws-cdk/core'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'

/**
 * Provides storage for A-GPS requests
 */
export class AGPSStorage extends CloudFormation.Resource {
	public readonly cacheTable: DynamoDB.ITable
	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		this.cacheTable = new DynamoDB.Table(this, 'cacheTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'cacheKey',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy:
				this.node.tryGetContext('isTest') === true
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})
	}
}
