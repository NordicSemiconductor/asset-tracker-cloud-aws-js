import * as path from 'path'

export const caFileLocations = (
	certsDir: string,
): {
	cert: string
	key: string
	verificationCert: string
	verificationKey: string
	csr: string
	id: string
} => ({
	cert: path.resolve(certsDir, 'rootCA.pem'),
	key: path.resolve(certsDir, 'rootCA.key'),
	verificationCert: path.resolve(certsDir, 'privateKeyVerification.pem'),
	verificationKey: path.resolve(certsDir, 'privateKeyVerification.key'),
	csr: path.resolve(certsDir, 'privateKeyVerification.csr'),
	id: path.resolve(certsDir, 'rootCA.id'),
})
