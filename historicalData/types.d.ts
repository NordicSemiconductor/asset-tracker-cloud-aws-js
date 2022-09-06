type SensorWithTimestamp = {
	v: unknown
	ts: number
}

type NumberValueSensor = SensorWithTimestamp & {
	v: number
}

type NumbersValueSensor = SensorWithTimestamp & {
	v: Record<string, number>
}

type NumbersAndStringsValueSensor = SensorWithTimestamp & {
	v: Record<string, number | string>
}

type UpdatedDeviceState = {
	reported: {
		cfg?: Record<string, number | boolean>
		bat?: NumberValueSensor
		env?: NumbersValueSensor
		acc?: NumbersValueSensor
		gnss?: NumbersValueSensor
		dev?: NumbersAndStringsValueSensor
		roam?: NumbersAndStringsValueSensor
	}
	deviceId: string
}

type DeviceMessage = {
	message: {
		magnitude?: {
			ts: number
			v: number
		}
		btn?: {
			v: number
			ts: number
		}
	}
	deviceId: string
}

type BatchMessage = {
	batch: {
		btn?: NumberValueSensor[]
		bat?: NumberValueSensor[]
		env?: NumbersValueSensor[]
		acc?: NumbersValueSensor[]
		gnss?: NumbersValueSensor[]
		dev?: NumbersAndStringsValueSensor[]
		roam?: NumbersAndStringsValueSensor[]
	}
	deviceId: string
}
