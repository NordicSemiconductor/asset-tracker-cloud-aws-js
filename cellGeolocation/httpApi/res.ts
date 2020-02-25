import { APIGatewayProxyResult } from 'aws-lambda'
import * as T from 'fp-ts/lib/Task'

export const res = (statusCode: number, options?: { expires: number }) => (
    body: any,
): T.Task<APIGatewayProxyResult> =>
    T.of({
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            ...(options?.expires && {
                'Cache-Control': `public, max-age=${options.expires}`,
                Expires: new Date(
                    new Date().getTime() + options.expires * 1000,
                ).toUTCString(),
            }),
        },
        body: JSON.stringify(body),
    })