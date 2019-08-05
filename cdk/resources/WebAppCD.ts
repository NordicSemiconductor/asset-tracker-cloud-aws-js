import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as CodeBuild from '@aws-cdk/aws-codebuild'
import * as CodePipeline from '@aws-cdk/aws-codepipeline'
import * as S3 from '@aws-cdk/aws-s3'

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
			bifravstStackId,
			buildSpec,
			description,
			sourceCodeActions,
		}: {
			sourceCodeActions: {
				bifravst: {
					action: CodePipeline.CfnPipeline.ActionDeclarationProperty
					outputName: string
				}
				webApp: {
					action: CodePipeline.CfnPipeline.ActionDeclarationProperty
					outputName: string
				}
			}
			bifravstStackId: string
			buildSpec: string
			description: string
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
				image: 'aws/codebuild/standard:2.0',
				environmentVariables: [
					{
						name: 'STACK_ID',
						value: bifravstStackId,
					},
				],
			},
		})
		this.codeBuildProject.node.addDependency(codeBuildRole)

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
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
						sourceCodeActions.bifravst.action,
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
									name: sourceCodeActions.bifravst.outputName,
								},
								{
									name: sourceCodeActions.webApp.outputName,
								},
							],
							actionTypeId: BuildActionCodeBuild,
							configuration: {
								ProjectName: this.codeBuildProject.name,
								PrimarySource: sourceCodeActions.bifravst.outputName,
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
