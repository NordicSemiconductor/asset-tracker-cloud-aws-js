import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { createToken } from './createToken.js'
import { describe, it } from 'node:test'
import { check, objectMatching } from 'tsmatchers'

void describe('createToken', () => {
	void it('should create a token', () => {
		const key = execSync('openssl ecparam -name prime256v1 -genkey', {
			encoding: 'utf8',
		})
		const teamId = randomUUID()
		const token = createToken(teamId, key)
		check(jwt.verify(token, key)).is(
			objectMatching({
				aud: teamId,
			}),
		)
	})
})
