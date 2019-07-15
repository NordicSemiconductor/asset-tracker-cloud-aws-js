import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as CodeBuild from '@aws-cdk/aws-codebuild'

/**
 * This is the CloudFormation stack sets up the continuous deployment of the project.
 */
export class BifravstContinuousDeploymentStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		properties: {
			repo: string
			owner: string
		},
	) {
		super(parent, id)

		const { repo, owner } = properties

		const codeBuildRole = new IAM.Role(this, 'CodeBuildRole', {
			assumedBy: new IAM.ServicePrincipal('codebuild.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: ['*'],
						}),
					],
				}),
			},
		})

		codeBuildRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: [codeBuildRole.roleArn],
				actions: ['iam:PassRole', 'iam:GetRole'],
			}),
		)

		new CodeBuild.Project(this, 'CodeBuildProject', {
			projectName: id,
			description: `This project sets up the continuous integration of the Bifravst project`,
			source: CodeBuild.Source.gitHub({
				cloneDepth: 25,
				repo,
				owner,
				reportBuildStatus: true,
				webhook: true,
			}),
			environment: {
				computeType: CodeBuild.ComputeType.LARGE,
				buildImage: CodeBuild.LinuxBuildImage.STANDARD_2_0,
				environmentVariables: {
					GH_USERNAME: {
						value: '/codebuild/github-username',
						type: CodeBuild.BuildEnvironmentVariableType.PARAMETER_STORE,
					},
					GH_TOKEN: {
						value: '/codebuild/github-token',
						type: CodeBuild.BuildEnvironmentVariableType.PARAMETER_STORE,
					},
				},
			},
			role: codeBuildRole,
		})
	}
}
