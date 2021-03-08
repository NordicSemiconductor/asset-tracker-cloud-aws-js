import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as CodeBuild from '@aws-cdk/aws-codebuild'
import * as CodePipeline from '@aws-cdk/aws-codepipeline'
import * as SSM from '@aws-cdk/aws-ssm'
import * as S3 from '@aws-cdk/aws-s3'
import { BuildActionCodeBuild, WebAppCD } from '../resources/WebAppCD'
import { CONTINUOUS_DEPLOYMENT_STACK_NAME, CORE_STACK_NAME } from './stackName'
import { enabledInContext } from '../helper/enabledInContext'
import { info } from '../helper/note'
import * as chalk from 'chalk'

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
			deviceUI: {
				owner: string
				repo: string
				branch: string
			}
		},
	) {
		super(parent, CONTINUOUS_DEPLOYMENT_STACK_NAME)

		const { core, deviceUI, webApp } = properties

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

		// CD for the Device Simulator Web Application is implied by enabled CD (in that case this Stack exists) and enabled Device Simulator Web Application
		const enableDeviceUICD = checkFlag({
			key: 'deviceui',
			component: 'Device Simulator Web Application Continuous Deployment',
			onUndefined: 'enabled',
		})
		new CloudFormation.CfnOutput(this, 'deviceUICD', {
			value: enableDeviceUICD ? 'enabled' : 'disabled',
			exportName: `${this.stackName}:deviceUICD`,
			description:
				'Whether the continuous deployment of the Device Simulator Web Application is enabled or disabled.',
		})
		if (enableDeviceUICD) {
			info(
				'Continuous Deployment',
				`Monitoring ${chalk.white(
					`${deviceUI.owner}/${deviceUI.repo}@${deviceUI.branch}`,
				)}`,
			)
		}

		// CD for the Device Simulator Web Application is implied by enabled CD (in that case this Stack exists) and enabled Device Simulator Web Application
		const enabledFirmwareCiCD = checkFlag({
			key: 'firmware-ci',
			component: 'Firmware CI Continuous Deployment',
			onUndefined: 'disabled',
		})
		new CloudFormation.CfnOutput(this, 'firmwareCiCD', {
			value: enabledFirmwareCiCD ? 'enabled' : 'disabled',
			exportName: `${this.stackName}:firmwareCiCD`,
			description:
				'Whether the continuous deployment of the Firmware CI is enabled or disabled.',
		})

		// Wheter the UnwiredLabs API is enabled
		const unwiredLabsEnabled = checkFlag({
			key: 'unwiredlabs',
			component: 'UnwiredLabs API',
			onUndefined: 'disabled',
			silent: true,
		})

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
				image: 'aws/codebuild/standard:5.0',
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
					{
						name: 'WEBAPP',
						value: enableWebAppCD ? '1' : '0',
					},
					{
						name: 'DEVICEUI',
						value: enableDeviceUICD ? '1' : '0',
					},
					{
						name: 'FIRMWARECI',
						value: enabledFirmwareCiCD ? '1' : '0',
					},
					{
						name: 'UNWIREDLABS',
						value: unwiredLabsEnabled ? '1' : '0',
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

		const deviceUISourceCodeAction = sourceCodeAction({
			name: 'DeviceUISourceCode',
			outputName: 'DeviceUI',
			Branch: deviceUI.branch,
			Owner: deviceUI.owner,
			Repo: deviceUI.repo,
			githubToken,
		})

		// Sets up the continuous deployment for the web app
		let webAppCDProject
		if (enableWebAppCD) {
			webAppCDProject = new WebAppCD(
				this,
				`${CONTINUOUS_DEPLOYMENT_STACK_NAME}-webAppCD`,
				{
					description: 'Continuously deploys the Cat Tracker web application',
					sourceCodeActions: {
						core: coreSourceCodeAction,
						webApp: webAppSourceCodeAction,
					},
					buildSpec: 'continuous-deployment-web-app.yml',
					githubToken,
				},
			).codeBuildProject
		}

		// Sets up the continuous deployment for the Device Simulator Web Application
		let deviceUICDProject
		if (enableDeviceUICD) {
			deviceUICDProject = new WebAppCD(
				this,
				`${CONTINUOUS_DEPLOYMENT_STACK_NAME}-deviceUICD`,
				{
					description:
						'Continuously deploys the Cat Tracker device simulator web application',
					sourceCodeActions: {
						core: coreSourceCodeAction,
						webApp: deviceUISourceCodeAction,
					},
					buildSpec: 'continuous-deployment-device-ui-app.yml',
					githubToken,
				},
			).codeBuildProject
		}

		// Set up the continuous deployment for the nRF Asset Tracker resources.
		// This will also run the deployment of the WebApp and DeviceUI after a deploy
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
								...(deviceUICDProject !== undefined
									? [deviceUICDProject.attrArn]
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
						...(enableDeviceUICD ? [deviceUISourceCodeAction.action] : []),
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
						...(deviceUICDProject
							? [
									{
										name: 'DeployDeviceUI',
										inputArtifacts: [
											{
												name: coreSourceCodeAction.outputName,
											},
											{
												name: deviceUISourceCodeAction.outputName,
											},
										],
										actionTypeId: BuildActionCodeBuild,
										configuration: {
											ProjectName: deviceUICDProject.name,
											PrimarySource: coreSourceCodeAction.outputName,
										},
										outputArtifacts: [
											{
												name: 'DeviceUIBuildId',
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
	deviceUICD: 'enabled' | 'disabled'
}
