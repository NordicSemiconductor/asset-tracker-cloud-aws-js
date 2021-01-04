import { stackOutput } from '@bifravst/cloudformation-helpers'
import {
	ApiGatewayV2Client,
	CreateRouteCommand,
} from '@aws-sdk/client-apigatewayv2'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { StackOutputs } from '../stacks/Bifravst'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { region } from '../regions'
import { v4 } from 'uuid'

/**
 * This creates a fake route after CloudFormation has finished deploying the
 * HTTP API in order to address it's flaky behaviour.
 *
 * @see https://github.com/bifravst/aws/issues/455
 */
const main = async () => {
	const { geolocationApiId } = await stackOutput(
		new CloudFormationClient({ region }),
	)<StackOutputs>(CORE_STACK_NAME)

	const r = await new ApiGatewayV2Client({ region }).send(
		new CreateRouteCommand({
			ApiId: geolocationApiId,
			RouteKey: `GET /__fake_${v4()}`,
		}),
	)

	console.log(r)
}

void main()
