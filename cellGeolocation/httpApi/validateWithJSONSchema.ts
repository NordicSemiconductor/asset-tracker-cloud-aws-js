import { Either, left, right } from 'fp-ts/lib/Either.js'
import { ErrorInfo, ErrorType } from '../ErrorInfo.js'
import Ajv from 'ajv'
import { Static, TObject, TProperties } from '@sinclair/typebox'

export const validateWithJSONSchema = <T extends TObject<TProperties>>(
	schema: T,
): ((
	value: Record<string, any>,
) => Either<ErrorInfo, Static<typeof schema>>) => {
	const ajv = new Ajv()
	// see @https://github.com/sinclairzx81/typebox/issues/51
	ajv.addKeyword('kind')
	ajv.addKeyword('modifier')
	const v = ajv.compile(schema)
	return (value: Record<string, any>) => {
		const valid = v(value)
		if (valid !== true) {
			return left({
				type: ErrorType.BadRequest,
				message: 'Validation failed!',
				detail: v.errors,
			})
		}
		return right(value as Static<typeof schema>)
	}
}
