import { APIGatewayProxyResult } from 'aws-lambda'

export const handler = async (): Promise<APIGatewayProxyResult> => ({
	statusCode: 200,
	headers: {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({ status: 'OK' }),
})
