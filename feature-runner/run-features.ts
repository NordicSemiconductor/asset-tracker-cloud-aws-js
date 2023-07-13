/**
 * This file configures the BDD Feature runner
 * by loading the configuration for the test resources
 * (like AWS services) and providing the required
 * step runners and reporters.
 */

import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { runFolder } from '@nordicsemiconductor/bdd-markdown'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import * as path from 'node:path'
import {
	CORE_STACK_NAME,
	FIRMWARE_CI_STACK_NAME,
	HTTP_MOCK_HTTP_API_STACK_NAME,
} from '../cdk/stacks/stackName.js'
import type { StackOutputs } from '../cdk/stacks/AssetTracker/stack.js'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint.js'
import { IoTClient } from '@aws-sdk/client-iot'
import type { StackOutputs as FirmwareCIStackOutputs } from '../cdk/stacks/FirmwareCI.js'
import type { StackOutputs as HttpApiMockStackOutputs } from '../cdk/test-resources/HttpApiMockStack.js'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { gpsDay } from '../pgps/gpsTime.js'
import { readFile } from 'node:fs/promises'
import { certsDir } from '../cli/jitp/certsDir.js'
import randomSteps from './steps/random.js'
import awsSDKSteps from './steps/aws.js'
import contextSteps from './steps/context.js'
import cognitoSteps from './steps/cognito.js'
import trackerSteps from './steps/tracker.js'
import timestreamStepRunners from './steps/timestream.js'

const cf = new CloudFormationClient({})
const sts = new STSClient({})
const iot = new IoTClient({})

export type World = typeof StackOutputs & {
	accountId: string
	userIotPolicyName: string
	historicaldataTableName: string
	historicaldataDatabaseName: string
	firmwareCI: {
		userAccessKeyId: string
		userSecretAccessKey: string
		bucketName: string
	}
	awsIotRootCA: string
	httpApiMock: {
		requestsTableName: string
		responsesTableName: string
		apiURL: string
	}
	region: string
	currentGpsDay: number
}

const stackConfig = await stackOutput(cf)<typeof StackOutputs>(CORE_STACK_NAME)
const mqttEndpoint = await getIotEndpoint(iot)

const firmwareCIStackConfig = await stackOutput(cf)<FirmwareCIStackOutputs>(
	FIRMWARE_CI_STACK_NAME,
)
const httpApiMockStackConfig = await stackOutput(cf)<HttpApiMockStackOutputs>(
	HTTP_MOCK_HTTP_API_STACK_NAME,
)

const { Account: accountId } = await sts.send(new GetCallerIdentityCommand({}))

const [historicaldataDatabaseName, historicaldataTableName] =
	stackConfig.historicaldataTableInfo.split('|') as [string, string]
const world: World = {
	...stackConfig,
	firmwareCI: {
		userAccessKeyId: firmwareCIStackConfig.userAccessKeyId,
		userSecretAccessKey: firmwareCIStackConfig.userSecretAccessKey,
		bucketName: firmwareCIStackConfig.bucketName,
	},
	userIotPolicyName: stackConfig.userIotPolicyName,
	historicaldataTableName,
	historicaldataDatabaseName,
	accountId: accountId as string,
	awsIotRootCA: await readFile(
		path.join(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		'utf-8',
	),
	httpApiMock: {
		requestsTableName: httpApiMockStackConfig.requestsTableName,
		responsesTableName: httpApiMockStackConfig.responsesTableName,
		apiURL: httpApiMockStackConfig.apiURL,
	},
	region: mqttEndpoint.split('.')[2] as string,
	currentGpsDay: gpsDay(),
}

console.error(chalk.yellow.bold(' World:'))
console.error()
console.error(world)
console.error()

const print = (arg: unknown) =>
	typeof arg === 'object' ? JSON.stringify(arg) : arg

const runner = await runFolder<World & Record<string, any>>({
	folder: path.join(process.cwd(), 'features'),
	name: 'nRF Asset Tracker for AWS',
	logObserver: {
		onDebug: (info, ...args) =>
			console.error(
				chalk.magenta.dim(info.context.keyword),
				chalk.magenta(info.context.title),
				...args.map((arg) => chalk.cyan(print(arg))),
			),
		onError: (info, ...args) =>
			console.error(
				chalk.magenta.dim(info.context.keyword),
				chalk.magenta(info.context.title),
				...args.map((arg) => chalk.red(print(arg))),
			),
		onInfo: (info, ...args) =>
			console.error(
				chalk.magenta.dim(info.context.keyword),
				chalk.magenta(info.context.title),
				...args.map((arg) => chalk.green(print(arg))),
			),
		onProgress: (info, ...args) =>
			console.error(
				chalk.magenta.dim(info.context.keyword),
				chalk.magenta(info.context.title),
				...args.map((arg) => chalk.yellow(print(arg))),
			),
	},
})

runner
	.addStepRunners(...randomSteps)
	.addStepRunners(...awsSDKSteps)
	.addStepRunners(...contextSteps)
	.addStepRunners(...cognitoSteps)
	.addStepRunners(
		...trackerSteps({
			certsDir: await certsDir({
				iotEndpoint: mqttEndpoint,
				accountId: accountId as string,
			}),
			mqttEndpoint,
		}),
	)
	.addStepRunners(...timestreamStepRunners)

const res = await runner.run(world)

console.log(JSON.stringify(res, null, 2))

if (!res.ok) process.exit(1)
