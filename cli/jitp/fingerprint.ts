import { execSync } from 'child_process'

export const fingerprint = (pem: string): string =>
	execSync('openssl x509 -noout -fingerprint -sha1 -inform pem', {
		input: Buffer.from(pem),
	})
		.toString()
		.replace(/^sha1 Fingerprint=/, '')
		.replace(/:/g, '')
		.trim()
