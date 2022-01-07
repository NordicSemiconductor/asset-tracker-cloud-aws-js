import { SSMClient } from '@aws-sdk/client-ssm'
import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { Static, Type } from '@sinclair/typebox'
import { pipe } from 'fp-ts/function'
import { isLeft } from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { URL } from 'url'
import { agpsRequestSchema, AGPSType } from '../../agps/types.js'
import { ErrorInfo, ErrorType } from '../../api/ErrorInfo.js'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema.js'
import { fromEnv } from '../../util/fromEnv.js'
import { apiClient } from './apiclient.js'
import { getAGPSLocationApiSettings } from './settings.js'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getAGPSLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

const apiRequestSchema = Type.Object(
	{
		eci: PositiveInteger,
		tac: PositiveInteger,
		requestType: Type.RegEx(/^custom$/),
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
		customTypes: Type.Array(Type.Enum(AGPSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(agpsRequestSchema)

export const handler = async (
	agps: Static<typeof agpsRequestSchema>,
): Promise<{ resolved: boolean; dataHex?: readonly string[] }> => {
	console.log(JSON.stringify({ event: agps }))
	const valid = validateInput(agps)
	if (isLeft(valid)) {
		console.error(JSON.stringify(valid.left))
		return {
			resolved: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const { mcc, mnc, cell, area, types } = valid.right

	// Split requests, so that request for Ephemerides is a separate one
	const otherTypesInRequest = types.filter((t) => t !== AGPSType.Ephemerides)
	const requestTypes = []
	if (types.includes(AGPSType.Ephemerides))
		requestTypes.push([AGPSType.Ephemerides])
	if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

	const res = await pipe(
		requestTypes,
		TE.traverseArray((types) =>
			pipe(
				TE.right({
					resource: 'location/agps',
					payload: {
						eci: cell,
						tac: area,
						requestType: 'custom',
						mcc,
						mnc,
						customTypes: types,
					},
					headers: {
						'Content-Type': 'application/octet-stream',
					},
				}),
				TE.chain((request) =>
					pipe(
						c.head({
							...request,
							method: 'GET',
							requestSchema: apiRequestSchema,
						}),
						TE.chain((headers) =>
							c.getBinary({
								...request,
								headers: {
									...request.headers,
									Range: `bytes=0-${headers['content-length']}`,
								},
								requestSchema: apiRequestSchema,
							}),
						),
						TE.chain((agpsData) =>
							pipe(
								agpsData,
								verify,
								TE.fromEither,
								TE.mapLeft(
									(error) =>
										({
											type: ErrorType.BadGateway,
											message: `Could not verify A-GPS payload: ${error.message}!`,
										} as ErrorInfo),
								),
								TE.map((agpsDataInfo) => {
									console.log(JSON.stringify({ agpsData: agpsDataInfo }))
									return agpsData.toString('hex')
								}),
							),
						),
					),
				),
			),
		),
	)()

	if (isLeft(res)) {
		console.error(JSON.stringify(res.left))
		return {
			resolved: false,
		}
	}

	// If any request fails, mark operation as failed
	if (res.right.length !== requestTypes.length) {
		console.error(
			`Resolved ${res.right.length}, expected ${requestTypes.length}!`,
		)
		return {
			resolved: false,
		}
	}

	return {
		resolved: true,
		dataHex: res.right,
	}
}
