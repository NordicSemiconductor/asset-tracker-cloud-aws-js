import CloudFormation from 'aws-cdk-lib'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'

/**
 * Provides storage for P-GPS requests
 */
export class PGPSStorage extends CloudFormation.Resource {
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
