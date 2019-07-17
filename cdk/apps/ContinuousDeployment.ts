import * as CloudFormation from '@aws-cdk/core'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment'

export class ContinuousDeploymentApp extends CloudFormation.App {
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

		new ContinuousDeploymentStack(this, props.stackId, props)
	}
}
