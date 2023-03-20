import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs/protocol'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo.js'
import { res } from '../../api/res.js'
import { fromEnv } from '../../util/fromEnv.js'
import { geolocateSurvey, Survey } from '../geolocateSurvey.js'

const inputSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithType(inputSchema)

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

const surveyResolver =
	({ sf, stateMachineArn }: { sf: SFNClient; stateMachineArn: string }) =>
	async (survey: Survey): Promise<void> => {
		// We specify name when executing step function because we want to run exactly once.
		// In case there are concurrency requests for the same survey id, there will be only one to get executed.
		// https://docs.aws.amazon.com/step-functions/latest/apireference/API_StartExecution.html
		// Send to step function
		try {
			console.log(`StepFunction: Start execution name: ${survey.surveyId}`)
			await sf.send(
				new StartExecutionCommand({
					stateMachineArn,
					input: JSON.stringify(survey),
					name: survey.surveyId,
				}),
			)
		} catch (error: unknown) {
			console.error(`StepFunction: error:`, error)
		}
	}

const resolveSurvey = surveyResolver({
	sf,
	stateMachineArn,
})

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const id = event.requestContext.http.path.slice(1) // path: /3bf67b25-acd9-474c-b97a-3cb6083b7c44
	const maybeValidRequest = validateInput({ id })
	if ('errors' in maybeValidRequest) {
		return res(toStatusCode[ErrorType.BadRequest])(maybeValidRequest.errors)
	}

	const maybeSurvey = await locator(maybeValidRequest.id)
	if ('error' in maybeSurvey) {
		if (maybeSurvey.error.type === ErrorType.EntityNotFound) {
			return res(toStatusCode[maybeSurvey.error.type], {
				expires: 86400,
			})({
				type: ErrorType.EntityNotFound,
				message: `Network survey not found!`,
			})
		}
		return res(toStatusCode[maybeSurvey.error.type], {
			expires: 60,
		})(maybeSurvey.error)
	}

	console.log(JSON.stringify(maybeSurvey))

	const {
		survey: { location, unresolved },
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
			message: 'Network survey geolocation could not be resolved',
		})
	}

	// Start step function execution
	await resolveSurvey(maybeSurvey.survey)

	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for Network survey geolocation in process',
	})
}
