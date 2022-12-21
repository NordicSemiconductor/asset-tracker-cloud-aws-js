import * as jwt from 'jsonwebtoken'

export const createToken = (teamId: string, serviceKey: string): string =>
	jwt.sign({ aud: teamId }, serviceKey, {
		algorithm: 'ES256',
	})
