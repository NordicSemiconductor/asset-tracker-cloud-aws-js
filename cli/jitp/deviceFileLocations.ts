import path from 'path'

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
	simulatorJSON: string
} => ({
	key: path.resolve(certsDir, `device-${deviceId}.key`),
	csr: path.resolve(certsDir, `device-${deviceId}.csr`),
	cert: path.resolve(certsDir, `device-${deviceId}.pem`),
	certWithCA: path.resolve(certsDir, `device-${deviceId}.bundle.pem`),
	simulatorJSON: path.resolve(certsDir, `device-${deviceId}.json`),
})
