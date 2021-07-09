export enum ErrorType {
	EntityNotFound = 'EntityNotFound',
	BadRequest = 'BadRequest',
	AccessDenied = 'AccessDenied',
	InternalError = 'InternalError',
	Conflict = 'Conflict',
	BadGateway = 'BadGateway',
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
	[ErrorType.Conflict]: 409,
	[ErrorType.BadGateway]: 502,
}
