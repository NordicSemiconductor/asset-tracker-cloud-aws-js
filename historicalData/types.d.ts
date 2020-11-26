type UpdatedDeviceState = {
	reported: {
		cfg?: Record<string, number | boolean>
		bat?: {
			v: number
			ts: number
		}
		env?: {
			v: Record<string, number>
			ts: number
		}
		acc?: {
			v: Record<string, number>
			ts: number
		}
		gps?: {
			v: Record<string, number>
			ts: number
		}
		dev?: {
			v: Record<string, number | string>
			ts: number
		}
		roam?: {
			v: Record<string, number | string>
			ts: number
		}
	}
	timestamp: number
	deviceId: string
}
