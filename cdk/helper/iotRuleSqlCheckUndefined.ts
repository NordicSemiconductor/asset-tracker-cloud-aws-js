export const iotRuleSqlCheckUndefined = (fields: string[]): string =>
	fields.map((f) => `isUndefined(${f}) = false`).join(' AND ')
