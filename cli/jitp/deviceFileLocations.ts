import * as path from 'path'

export const deviceFileLocations = (certsDir: string, deviceId: string) => ({
	key: path.resolve(certsDir, `device-${deviceId}.key`),
	csr: path.resolve(certsDir, `device-${deviceId}.csr`),
	cert: path.resolve(certsDir, `device-${deviceId}.pem`),
	certWithCA: path.resolve(certsDir, `device-${deviceId}.bundle.pem`),
})
