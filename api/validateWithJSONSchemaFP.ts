import type { Static, TSchema } from '@sinclair/typebox'
import Ajv from 'ajv'
import * as E from 'fp-ts/lib/Either'
import { ErrorInfo, ErrorType } from './ErrorInfo.js'

/**
 * @deprecated use validateWithJSONSchema() because fp-ts is getting gradually phased out from this code-base
 */
export const validateWithJSONSchemaFP = <T extends TSchema>(
	schema: T,
): ((value: unknown) => E.Either<ErrorInfo, Static<typeof schema>>) => {
	const ajv = new Ajv()
	// see @https://github.com/sinclairzx81/typebox/issues/51
	ajv.addKeyword('kind')
	ajv.addKeyword('modifier')
	const v = ajv.compile(schema)
	return (value: unknown) => {
		const valid = v(value)
		if (valid !== true) {
			return E.left({
				type: ErrorType.BadRequest,
				message: 'Validation failed!',
				detail: {
					errors: v.errors,
					input: value,
				},
			})
		}
		return E.right(value as Static<typeof schema>)
	}
}
