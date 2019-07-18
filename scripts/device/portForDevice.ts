/**
 * Calculates a stable port number based on the device id
 */
export const portForDevice = ({ deviceId }: { deviceId: string }): number => {
	let hash = 0
	for (let i = 0; i < deviceId.length; i++) {
		hash = (hash << 5) - hash + deviceId.charCodeAt(i)
		hash |= 0 // Convert to 32bit integer
	}
	return 1024 + Math.round((hash / Math.pow(2, 31)) * (65535 - 1024))
}
