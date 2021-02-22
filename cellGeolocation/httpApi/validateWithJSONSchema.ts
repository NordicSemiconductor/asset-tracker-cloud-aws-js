import * as E from 'fp-ts/lib/Either'
import { ErrorInfo, ErrorType } from '../ErrorInfo'
import Ajv from 'ajv'
import { Static, TObject, TProperties } from '@sinclair/typebox'

export const validateWithJSONSchema = <T extends TObject<TProperties>>(
	schema: T,
): ((
	value: Record<string, any>,
) => E.Either<ErrorInfo, Static<typeof schema>>) => {
	const ajv = new Ajv()
	// see @https://github.com/sinclairzx81/typebox/issues/51
	ajv.addKeyword('kind')
	ajv.addKeyword('modifier')
	const v = ajv.compile(schema)
	return (value: Record<string, any>) => {
		const valid = v(value)
		if (valid !== true) {
			return E.left({
				type: ErrorType.BadRequest,
				message: 'Validation failed!',
				detail: v.errors,
			})
		}
		return E.right(value as Static<typeof schema>)
	}
}
