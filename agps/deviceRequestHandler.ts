import { SQSEvent } from 'aws-lambda'

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify(event))
}
