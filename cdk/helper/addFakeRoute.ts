import { stackOutput } from '@bifravst/cloudformation-helpers'
import { CloudFormation, ApiGatewayV2 } from 'aws-sdk'
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
		new CloudFormation({ region }),
	)<StackOutputs>(CORE_STACK_NAME)

	const r = await new ApiGatewayV2({ region })
		.createRoute({
			ApiId: geolocationApiId,
			RouteKey: `GET /__fake_${v4()}`,
		})
		.promise()

	console.log(r)
}

void main()
