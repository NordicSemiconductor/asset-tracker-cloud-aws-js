import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'
import type { Survey } from '../geolocateSurvey'
import { geolocateSurvey } from '../geolocateSurvey'

const { surveysTable } = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
})(process.env)

const dynamodb = new DynamoDBClient({})
const locator = geolocateSurvey({
	dynamodb,
	TableName: surveysTable,
})

export const handler = async (input: {
	surveyId: string
}): Promise<MaybeLocation & { survey?: Survey }> => {
	const maybeSurvey = await locator(input.surveyId)
	if ('error' in maybeSurvey) {
		return {
			located: false,
		}
	}

	if ('location' in maybeSurvey.survey) {
		return {
			located: true,
			...maybeSurvey.survey.location,
		}
	}

	return {
		located: false,
		survey: maybeSurvey.survey,
	}
}
