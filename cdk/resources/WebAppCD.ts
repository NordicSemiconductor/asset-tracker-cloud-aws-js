import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as CodeBuild from '@aws-cdk/aws-codebuild'
import * as CodePipeline from '@aws-cdk/aws-codepipeline'
import * as SSM from '@aws-cdk/aws-ssm'
import * as S3 from '@aws-cdk/aws-s3'

/**
 * This sets up the continuous delivery for a web-app
 */
export class WebAppCD extends CloudFormation.Construct {
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			bifravstStackId,
			bifravstAWS,
			webApp,
			githubToken,
			buildSpec,
			description,
		}: {
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
			bifravstStackId: string
			githubToken: SSM.IStringParameter
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

		const project = new CodeBuild.CfnProject(this, 'CodeBuildProject', {
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
		project.node.addDependency(codeBuildRole)

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
		})

		const pipelineRole = new IAM.Role(this, 'CodePipelineRole', {
			assumedBy: new IAM.ServicePrincipal('codepipeline.amazonaws.com'),
			inlinePolicies: {
				controlCodeBuild: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: [project.attrArn],
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
						{
							name: 'BifravstAWSSourceCode',
							actionTypeId: {
								category: 'Source',
								owner: 'ThirdParty',
								version: '1',
								provider: 'GitHub',
							},
							outputArtifacts: [
								{
									name: 'BifravstAWS',
								},
							],
							configuration: {
								Branch: bifravstAWS.branch,
								Owner: bifravstAWS.owner,
								Repo: bifravstAWS.repo,
								OAuthToken: githubToken.stringValue,
							},
						},
						{
							name: 'WebAppSourceCode',
							actionTypeId: {
								category: 'Source',
								owner: 'ThirdParty',
								version: '1',
								provider: 'GitHub',
							},
							outputArtifacts: [
								{
									name: 'WebApp',
								},
							],
							configuration: {
								Branch: webApp.branch,
								Owner: webApp.owner,
								Repo: webApp.repo,
								OAuthToken: githubToken.stringValue,
							},
						},
					],
				},
				{
					name: 'Deploy',
					actions: [
						{
							name: 'DeployWebApp',
							inputArtifacts: [{ name: 'BifravstAWS' }, { name: 'WebApp' }],
							actionTypeId: {
								category: 'Build',
								owner: 'AWS',
								version: '1',
								provider: 'CodeBuild',
							},
							configuration: {
								ProjectName: project.name,
								PrimarySource: 'BifravstAWS',
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
					matchEquals: `refs/heads/${webApp.branch}`,
				},
			],
			authentication: 'GITHUB_HMAC',
			authenticationConfiguration: {
				secretToken: githubToken.stringValue,
			},
			registerWithThirdParty: false,
		})
	}
}
