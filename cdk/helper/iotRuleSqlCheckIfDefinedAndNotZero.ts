export const iotRuleSqlCheckIfDefinedAndNotZero = (fields: string[]): string =>
	fields.map((f) => `(isUndefined(${f}) = true OR ${f} > 0)`).join(' AND ')
