import * as path from 'path'

export const deviceFileLocations = ({
	certsDir,
	deviceId,
}: {
	certsDir: string
	deviceId: string
}): {
	key: string
	csr: string
	cert: string
	certWithCA: string
	json: string
} => ({
	key: path.resolve(certsDir, `device-${deviceId}.key`),
	csr: path.resolve(certsDir, `device-${deviceId}.csr`),
	cert: path.resolve(certsDir, `device-${deviceId}.pem`),
	certWithCA: path.resolve(certsDir, `device-${deviceId}.bundle.pem`),
	json: path.resolve(certsDir, `device-${deviceId}.json`),
})
