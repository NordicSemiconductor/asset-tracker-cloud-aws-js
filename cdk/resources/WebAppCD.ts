import CloudFormation from '@aws-cdk/core'
import IAM from '@aws-cdk/aws-iam'
import CodeBuild from '@aws-cdk/aws-codebuild'
import CodePipeline from '@aws-cdk/aws-codepipeline'
import S3 from '@aws-cdk/aws-s3'
import SSM from '@aws-cdk/aws-ssm'
import { CORE_STACK_NAME } from '../stacks/stackName.js'

export const BuildActionCodeBuild = {
	category: 'Build',
	owner: 'AWS',
	version: '1',
	provider: 'CodeBuild',
}

/**
 * This sets up the continuous delivery for a web-app
 */
export class WebAppCD extends CloudFormation.Construct {
	public readonly codeBuildProject: CodeBuild.CfnProject
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			buildSpec,
			description,
			sourceCodeActions,
			githubToken,
		}: {
			sourceCodeActions: {
				core: {
					action: CodePipeline.CfnPipeline.ActionDeclarationProperty
					outputName: string
				}
				webApp: {
					action: CodePipeline.CfnPipeline.ActionDeclarationProperty
					outputName: string
				}
			}
			buildSpec: string
			description: string
			githubToken: SSM.IStringParameter
		},
	) {
		super(parent, id)

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

		this.codeBuildProject = new CodeBuild.CfnProject(this, 'CodeBuildProject', {
			name: id,
			description,
			source: {
				type: 'CODEPIPELINE',
				buildSpec,
			},
			serviceRole: codeBuildRole.roleArn,
			artifacts: {
				type: 'CODEPIPELINE',
			},
			environment: {
				type: 'LINUX_CONTAINER',
				computeType: 'BUILD_GENERAL1_LARGE',
				image: 'aws/codebuild/standard:5.0',
				environmentVariables: [
					{
						name: 'STACK_NAME',
						value: CORE_STACK_NAME,
					},
					{
						name: 'SOURCE_REPO_URL',
						value: `https://github.com/${sourceCodeActions.webApp.action.configuration.Owner}/${sourceCodeActions.webApp.action.configuration.Repo}.git`,
					},
					{
						name: 'GH_TOKEN',
						value: githubToken.stringValue,
					},
					{
						name: 'CI',
						value: '1',
					},
				],
			},
		})
		this.codeBuildProject.node.addDependency(codeBuildRole)

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		const pipelineRole = new IAM.Role(this, 'CodePipelineRole', {
			assumedBy: new IAM.ServicePrincipal('codepipeline.amazonaws.com'),
			inlinePolicies: {
				controlCodeBuild: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: [this.codeBuildProject.attrArn],
							actions: ['codebuild:*'],
						}),
					],
				}),
				writeToCDBucket: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
							actions: ['s3:*'],
						}),
					],
				}),
			},
		})

		const pipeline = new CodePipeline.CfnPipeline(this, 'CodePipeline', {
			roleArn: pipelineRole.roleArn,
			artifactStore: {
				type: 'S3',
				location: bucket.bucketName,
			},
			name: id,
			stages: [
				{
					name: 'Source',
					actions: [
						sourceCodeActions.core.action,
						sourceCodeActions.webApp.action,
					],
				},
				{
					name: 'Deploy',
					actions: [
						{
							name: 'DeployWebApp',
							inputArtifacts: [
								{
									name: sourceCodeActions.core.outputName,
								},
								{
									name: sourceCodeActions.webApp.outputName,
								},
							],
							actionTypeId: BuildActionCodeBuild,
							configuration: {
								ProjectName: this.codeBuildProject.name,
								PrimarySource: sourceCodeActions.core.outputName,
							},
							outputArtifacts: [
								{
									name: 'BuildId',
								},
							],
						},
					],
				},
			],
		})
		pipeline.node.addDependency(pipelineRole)

		new CodePipeline.CfnWebhook(this, 'webhook', {
			name: `${id}-InvokePipelineFromGitHubChange`,
			targetPipeline: id,
			targetPipelineVersion: 1,
			targetAction: 'Source',
			filters: [
				{
					jsonPath: '$.ref',
					matchEquals: `refs/heads/${sourceCodeActions.webApp.action.configuration.Branch}`,
				},
			],
			authentication: 'GITHUB_HMAC',
			authenticationConfiguration: {
				secretToken: sourceCodeActions.webApp.action.configuration.OAuthToken,
			},
			registerWithThirdParty: false,
		})
	}
}
