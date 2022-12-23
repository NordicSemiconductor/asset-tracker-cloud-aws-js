import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo'
import { res } from '../../api/res'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { fromEnv } from '../../util/fromEnv'
import { geolocateSurvey } from '../geolocateSurvey'

const inputSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(inputSchema)

const { surveysTable, stateMachineArn } = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
	stateMachineArn: 'STEP_FUNCTION_ARN',
})(process.env)

const sf = new SFNClient({})

const dynamodb = new DynamoDBClient({})
const locator = geolocateSurvey({
	dynamodb,
	TableName: surveysTable,
})

const wifiSurveyResolver =
	({ sf, stateMachineArn }: { sf: SFNClient; stateMachineArn: string }) =>
	async ({ surveyId }: { surveyId: string }): Promise<void> => {
		// We specify name when executing step function because we want to run exactly once.
		// In case there are concurrency requests for the same survey id, there will be only one to get executed.
		// https://docs.aws.amazon.com/step-functions/latest/apireference/API_StartExecution.html
		// Send to step function
		try {
			console.log(`StepFunction: Start execution name: ${surveyId}`)
			await sf.send(
				new StartExecutionCommand({
					stateMachineArn,
					input: JSON.stringify({ surveyId }),
					name: surveyId,
				}),
			)
		} catch (error: unknown) {
			console.error(`StepFunction: error:`, error)
		}
	}

const resolveWifiSurvey = wifiSurveyResolver({
	sf,
	stateMachineArn,
})

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const id = event.requestContext.http.path.slice(1) // path: /3bf67b25-acd9-474c-b97a-3cb6083b7c44
	const maybeValidRequest = validateInput({ id })
	if ('error' in maybeValidRequest) {
		return res(toStatusCode[ErrorType.BadRequest])(maybeValidRequest.error)
	}

	const maybeSurvey = await locator(maybeValidRequest.id)
	if ('error' in maybeSurvey) {
		if (maybeSurvey.error.type === ErrorType.EntityNotFound) {
			return res(toStatusCode[maybeSurvey.error.type], {
				expires: 86400,
			})({
				type: ErrorType.EntityNotFound,
				message: `WiFi site survey not found!`,
			})
		}
		return res(toStatusCode[maybeSurvey.error.type], {
			expires: 60,
		})(maybeSurvey.error)
	}

	console.log(JSON.stringify(maybeSurvey))

	const {
		survey: { surveyId, location, unresolved },
	} = maybeSurvey

	// survey was located
	if (location !== undefined) {
		return res(200, {
			expires: 86400,
		})(location)
	}

	// survey was not resolved
	if (unresolved === true) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: 'WiFi site survey geolocation could not be resolved',
		})
	}

	// Start step function execution
	await resolveWifiSurvey({
		surveyId: surveyId,
	})

	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for WiFi site survey geolocation in process',
	})
}
