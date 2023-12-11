import CloudFormation from 'aws-cdk-lib'
import CodeBuild from 'aws-cdk-lib/aws-codebuild'
import CodePipeline from 'aws-cdk-lib/aws-codepipeline'
import IAM from 'aws-cdk-lib/aws-iam'
import S3 from 'aws-cdk-lib/aws-s3'
import SSM from 'aws-cdk-lib/aws-ssm'
import chalk from 'chalk'
import { enabledInContext } from '../helper/enabledInContext.js'
import { info } from '../helper/note.js'
import { BuildActionCodeBuild, WebAppCD } from '../resources/WebAppCD.js'
import {
	CONTINUOUS_DEPLOYMENT_STACK_NAME,
	CORE_STACK_NAME,
} from './stackName.js'

/**
 * This is the CloudFormation stack sets up the continuous deployment of the project.
 */
export class ContinuousDeploymentStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		properties: {
			core: {
				owner: string
				repo: string
				branch: string
			}
			webApp: {
				owner: string
				repo: string
				branch: string
			}
		},
	) {
		super(parent, CONTINUOUS_DEPLOYMENT_STACK_NAME)

		const { core, webApp } = properties

		info(
			'Continuous Deployment',
			`Monitoring ${chalk.white(`${core.owner}/${core.repo}@${core.branch}`)}`,
		)

		const checkFlag = enabledInContext(this.node)

		// CD for the Web App is implied by enabled CD (in that case this Stack exists) and enabled Web App
		const enableWebAppCD = checkFlag({
			key: 'webapp',
			component: 'Web App Continuous Deployment',
			onUndefined: 'enabled',
		})
		new CloudFormation.CfnOutput(this, 'webAppCD', {
			value: enableWebAppCD ? 'enabled' : 'disabled',
			exportName: `${this.stackName}:webAppCD`,
			description:
				'Whether the continuous deployment of the Web App is enabled or disabled.',
		})
		if (enableWebAppCD) {
			info(
				'Continuous Deployment',
				`Monitoring ${chalk.white(
					`${webApp.owner}/${webApp.repo}@${webApp.branch}`,
				)}`,
			)
		}

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

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		const githubToken = SSM.StringParameter.fromStringParameterAttributes(
			this,
			'ghtoken',
			{
				parameterName: `/${CORE_STACK_NAME}/codebuild/github/token`,
				version: 1,
			},
		)

		const project = new CodeBuild.CfnProject(this, 'CodeBuildProject', {
			name: CONTINUOUS_DEPLOYMENT_STACK_NAME,
			description: 'Continuous deploys the nRF Asset Tracker resources',
			source: {
				type: 'CODEPIPELINE',
				buildSpec: 'continuous-deployment.yml',
			},
			serviceRole: codeBuildRole.roleArn,
			artifacts: {
				type: 'CODEPIPELINE',
			},
			environment: {
				type: 'LINUX_CONTAINER',
				computeType: 'BUILD_GENERAL1_LARGE',
				image: 'aws/codebuild/standard:7.0',
				environmentVariables: [
					{
						name: 'GH_TOKEN',
						value: githubToken.stringValue,
					},
					{
						name: 'CI',
						value: '1',
					},
					{
						name: 'STACK_NAME',
						value: CORE_STACK_NAME,
					},
				],
			},
		})

		project.node.addDependency(codeBuildRole)

		const sourceCodeAction = ({
			name,
			outputName,
			Branch,
			Owner,
			Repo,
			githubToken,
		}: {
			name: string
			outputName: string
			Branch: string
			Owner: string
			Repo: string
			githubToken: SSM.IStringParameter
		}) => ({
			outputName,
			action: {
				name,
				actionTypeId: {
					category: 'Source',
					owner: 'ThirdParty',
					version: '1',
					provider: 'GitHub',
				},
				outputArtifacts: [
					{
						name: outputName,
					},
				],
				configuration: {
					Branch,
					Owner,
					Repo,
					OAuthToken: githubToken.stringValue,
				},
			},
		})

		const coreSourceCodeAction = sourceCodeAction({
			name: 'AssetTrackerAWSSourceCode',
			outputName: 'AssetTrackerAWS',
			Branch: core.branch,
			Owner: core.owner,
			Repo: core.repo,
			githubToken,
		})

		const webAppSourceCodeAction = sourceCodeAction({
			name: 'WebAppSourceCode',
			outputName: 'WebApp',
			Branch: webApp.branch,
			Owner: webApp.owner,
			Repo: webApp.repo,
			githubToken,
		})

		// Sets up the continuous deployment for the web app
		let webAppCDProject
		if (enableWebAppCD) {
			webAppCDProject = new WebAppCD(
				this,
				`${CONTINUOUS_DEPLOYMENT_STACK_NAME}-webAppCD`,
				{
					description:
						'Continuously deploys the nRF Asset Tracker web application',
					sourceCodeActions: {
						core: coreSourceCodeAction,
						webApp: webAppSourceCodeAction,
					},
					buildSpec: 'continuous-deployment-web-app.yml',
					githubToken,
				},
			).codeBuildProject
		}

		// Set up the continuous deployment for the nRF Asset Tracker resources.
		// This will also run the deployment of the WebApp after a deploy
		// (in case some outputs have changed and need to be made available to the apps).

		const codePipelineRole = new IAM.Role(this, 'CodePipelineRole', {
			assumedBy: new IAM.ServicePrincipal('codepipeline.amazonaws.com'),
			inlinePolicies: {
				controlCodeBuild: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: [
								project.attrArn,
								...(webAppCDProject !== undefined
									? [webAppCDProject.attrArn]
									: []),
							],
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
			roleArn: codePipelineRole.roleArn,
			artifactStore: {
				type: 'S3',
				location: bucket.bucketName,
			},
			name: CONTINUOUS_DEPLOYMENT_STACK_NAME,
			stages: [
				{
					name: 'Source',
					actions: [
						coreSourceCodeAction.action,
						...(enableWebAppCD ? [webAppSourceCodeAction.action] : []),
					],
				},
				{
					name: 'Deploy',
					actions: [
						{
							name: 'DeployCore',
							inputArtifacts: [
								{
									name: coreSourceCodeAction.outputName,
								},
							],
							actionTypeId: BuildActionCodeBuild,
							configuration: {
								ProjectName: project.name,
							},
							outputArtifacts: [
								{
									name: 'CoreBuildId',
								},
							],
							runOrder: 1,
						},
						...(webAppCDProject !== undefined
							? [
									{
										name: 'DeployWebApp',
										inputArtifacts: [
											{
												name: coreSourceCodeAction.outputName,
											},
											{
												name: webAppSourceCodeAction.outputName,
											},
										],
										actionTypeId: BuildActionCodeBuild,
										configuration: {
											ProjectName: webAppCDProject.name,
											PrimarySource: coreSourceCodeAction.outputName,
										},
										outputArtifacts: [
											{
												name: 'WebAppBuildId',
											},
										],
										runOrder: 2,
									},
								]
							: []),
					],
				},
			],
		})
		pipeline.node.addDependency(codePipelineRole)

		new CodePipeline.CfnWebhook(this, 'webhook', {
			name: `${CONTINUOUS_DEPLOYMENT_STACK_NAME}-InvokePipelineFromGitHubChange`,
			targetPipeline: CONTINUOUS_DEPLOYMENT_STACK_NAME,
			targetPipelineVersion: 1,
			targetAction: 'Source',
			filters: [
				{
					jsonPath: '$.ref',
					matchEquals: `refs/heads/${core.branch}`,
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

export type StackOutputs = {
	webAppCD: 'enabled' | 'disabled'
}
