export enum ErrorType {
	EntityNotFound = 'EntityNotFound',
	BadRequest = 'BadRequest',
	AccessDenied = 'AccessDenied',
	InternalError = 'InternalError',
}

export type ErrorInfo = {
	type: ErrorType
	message: string
	detail?: any
}

export const toStatusCode = {
	[ErrorType.BadRequest]: 400,
	[ErrorType.AccessDenied]: 403,
	[ErrorType.EntityNotFound]: 404,
	[ErrorType.InternalError]: 500,
}
