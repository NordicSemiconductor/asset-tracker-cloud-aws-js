import { APIGatewayProxyResult } from 'aws-lambda'
import T from 'fp-ts/lib/Task'

export const res = (statusCode: number, options?: { expires: number }) => (
	body: unknown,
): T.Task<APIGatewayProxyResult> =>
	T.of({
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
