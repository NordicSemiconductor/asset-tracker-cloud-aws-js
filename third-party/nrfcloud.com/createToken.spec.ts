import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { createToken } from './createToken.js'

describe('createToken', () => {
	it('should create a token', () => {
		const key = execSync('openssl ecparam -name prime256v1 -genkey', {
			encoding: 'utf8',
		})
		const teamId = randomUUID()
		const token = createToken(teamId, key)
		expect(jwt.verify(token, key)).toMatchObject({ aud: teamId })
	})
})
