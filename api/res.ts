import { APIGatewayProxyResultV2 } from 'aws-lambda'

export const res =
	(statusCode: number, options?: { expires: number }) =>
	(body: unknown): APIGatewayProxyResultV2 => ({
		statusCode,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': 'application/json',
			...(options?.expires !== undefined && {
				'Cache-Control': `public, max-age=${options.expires}`,
				Expires: new Date(
					new Date().getTime() + options.expires * 1000,
				).toUTCString(),
			}),
			'X-asset-tracker-Version': process.env.VERSION ?? 'unknown',
		},
		body: JSON.stringify(body),
	})
