export type SensorWithTimestamp = {
	v: unknown
	ts: number
}

export type NumberValueSensor = SensorWithTimestamp & {
	v: number
}

export type NumbersValueSensor = SensorWithTimestamp & {
	v: Record<string, number>
}

export type NumbersAndStringsValueSensor = SensorWithTimestamp & {
	v: Record<string, number | string>
}

export type UpdatedDeviceState = {
	reported: {
		cfg?: Record<string, number | boolean>
		bat?: NumberValueSensor
		env?: NumbersValueSensor
		acc?: NumbersValueSensor
		gps?: NumbersValueSensor
		dev?: NumbersAndStringsValueSensor
		roam?: NumbersAndStringsValueSensor
	}
	deviceId: string
}

export type DeviceMessage = {
	message: {
		btn?: {
			v: number
			ts: number
		}
	}
	deviceId: string
}

export type BatchMessage = {
	batch: {
		btn?: NumberValueSensor[]
		bat?: NumberValueSensor[]
		env?: NumbersValueSensor[]
		acc?: NumbersValueSensor[]
		gps?: NumbersValueSensor[]
		dev?: NumbersAndStringsValueSensor[]
		roam?: NumbersAndStringsValueSensor[]
	}
	deviceId: string
}
