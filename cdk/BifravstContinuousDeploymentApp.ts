import * as CloudFormation from '@aws-cdk/core'
import { BifravstContinuousDeploymentStack } from './BifravstContinuousDeploymentStack'

export class BifravstContinuousDeploymentApp extends CloudFormation.App {
	public constructor(props: {
		stackId: string
		bifravstStackId: string
		owner: string
		repo: string
		branch: string
		app: {
			owner: string
			repo: string
			branch: string
		}
	}) {
		super()

		new BifravstContinuousDeploymentStack(this, props.stackId, props)
	}
}
