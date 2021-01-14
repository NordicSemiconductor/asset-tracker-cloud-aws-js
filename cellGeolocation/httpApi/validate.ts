import * as E from 'fp-ts/lib/Either'
import { ErrorInfo, ErrorType } from '../ErrorInfo.js'
import * as Ajv from 'ajv'

export const validate = <T>(schema: Ajv.ValidateFunction) => (
	value: Record<string, any>,
) => (): E.Either<ErrorInfo, T> => {
	const valid = schema(value)
	if (valid !== true) {
		return E.left({
			type: ErrorType.BadRequest,
			message: 'Validation failed!',
			detail: schema.errors,
		})
	}
	return E.right(value as T)
}
