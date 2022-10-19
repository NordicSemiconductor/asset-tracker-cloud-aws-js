import { Static, TSchema } from '@sinclair/typebox'
import Ajv from 'ajv'
import { ErrorInfo, ErrorType } from './ErrorInfo'

export const validateWithJSONSchema = <T extends TSchema>(
	schema: T,
): ((value: unknown) => { error: ErrorInfo } | Static<typeof schema>) => {
	const ajv = new Ajv()
	// see @https://github.com/sinclairzx81/typebox/issues/51
	ajv.addKeyword('kind')
	ajv.addKeyword('modifier')
	const v = ajv.compile(schema)
	return (value: unknown) => {
		const valid = v(value)
		if (valid !== true) {
			return {
				error: {
					type: ErrorType.BadRequest,
					message: 'Validation failed!',
					detail: {
						errors: v.errors,
						input: value,
					},
				},
			}
		}
		return value as Static<typeof schema>
	}
}
