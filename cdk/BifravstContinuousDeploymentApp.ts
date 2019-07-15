import * as CloudFormation from '@aws-cdk/core'
import { BifravstContinuousDeploymentStack } from './BifravstContinuousDeploymentStack'

export class BifravstContinuousDeploymentApp extends CloudFormation.App {
	public constructor(props: { stackId: string; owner: string; repo: string }) {
		super()

		new BifravstContinuousDeploymentStack(this, props.stackId, props)
	}
}
