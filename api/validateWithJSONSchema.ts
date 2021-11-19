import * as E from 'fp-ts/lib/Either'
import Ajv from 'ajv'
import {
	Static,
	StaticProperties,
	TObject,
	TProperties,
} from '@sinclair/typebox'
import { ErrorInfo, ErrorType } from './ErrorInfo'

export const validateWithJSONSchema = <
	T extends TObject<StaticProperties<TProperties>>,
>(
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
				detail: {
					errors: v.errors,
					input: value,
				},
			})
		}
		return E.right(value as Static<typeof schema>)
	}
}
