import * as CloudFormation from '@aws-cdk/core'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment'

export class ContinuousDeploymentApp extends CloudFormation.App {
	public constructor(props: {
		bifravstAWS: {
			owner: string
			repo: string
			branch: string
		}
		webApp: {
			owner: string
			repo: string
			branch: string
		}
		deviceUI: {
			owner: string
			repo: string
			branch: string
		}
	}) {
		super()

		new ContinuousDeploymentStack(this, props)
	}
}
