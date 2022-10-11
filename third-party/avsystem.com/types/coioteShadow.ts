import { Type } from '@sinclair/typebox'

const noValue = Type.Object({
	noValue: Type.Boolean({
		description: 'noValue',
	}),
})

const availableNetworkBearer = Type.String({
	minLength: 1,
	description: 'Available Network Bearer',
	examples: ['6', '7'],
})

const availablePowerSources = Type.String({
	minLength: 1,
	description: 'Available Power Sources',
	examples: ['1', '5'],
})

const powerSourceCurrent = Type.String({
	minLength: 1,
	description: 'Power Source Current',
	examples: ['125', '900'],
})

const powerSourceVoltage = Type.String({
	minLength: 1,
	description: 'Power Source Voltage',
	examples: ['3800', '50000'],
})

const applicationType = Type.String({
	minLength: 1,
	description: 'Application Type',
	examples: [
		'Simulated Accelerometer',
		'Simulated Light Sensor',
		'Simulated Colour Sensor',
		'Simulated Gas Resistance Sensor',
		'Simulated Humidity Sensor',
		'GPIO LED controller',
	],
})

const fractionalTimestamp = Type.Object(
	Type.Boolean({
		description: 'Fractional Timestamp',
	}),
)

const maxMeasuredValue = Type.String({
	minLength: 1,
	description: 'Max Measured Value',
	examples: ['10350.0', '51.197021'],
})

const maxRangeValue = Type.String({
	minLength: 1,
	description: 'Max Range Value',
	examples: ['19.6133', '1000000.0', '100.0'],
})

const measurementQualityIndicador = Type.String({
	minLength: 1,
	description: 'Measurement Quality Indicator',
	examples: '0',
})

const measurementQualityLevel = Type.Object(
	Type.Boolean({
		description: 'Measurement Quality Level',
	}),
)

const minMeasuredValue = Type.String({
	minLength: 1,
	description: 'Max Measured Value',
	examples: ['10350.0', '51.197021'],
})

const minRangeValue = Type.String({
	minLength: 1,
	examples: ['-19.6133', '0.0'],
})

const sensorUnits = Type.String({
	minLength: 1,
	description: 'Sensor Units',
	examples: ['m/s^2', 'RGB-IR', 'Ω', '', 'kPa', '°C'],
})

const sensorValue = Type.String({
	minLength: 1,
	description: 'Last or Current Measured Value from the Sensor.',
	examples: ['10350.0'],
})

const timestamp = Type.String({
	minLength: 1,
	description: 'Timestamp',
	examples: ['2022-10-03T12:18:41Z', '1970-01-01T00:00:00Z'],
})

/**
 * Connectivity Monitoring
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/4.xml
 */
export const connectivityMonitoring = Type.Object({
	APN: Type.Object({
		'0': Type.String({
			minLength: 1,
			description: 'APN',
			examples: 'ibasis.iot',
		}),
	}),
	'Available Network Bearer': Type.Object({
		'0': availableNetworkBearer,
		'1': availableNetworkBearer,
	}),
	'IP Addresses': Type.Object({
		'0': Type.String({
			minLength: 1,
			description:
				'The IP address of the next-hop IP router, on each of the interfaces specified in resource 4 (IP Addresses). Note: This IP Address doesnt indicate the Server IP address.',
			examples: '10.160.116.16t',
		}),
	}),
	'Router IP Addresses': Type.Object({}),
	'Cell ID': Type.String({
		minLength: 1,
		description:
			'Serving Cell ID in case Network Bearer Resource is a Cellular Network.',
		examples: '33703712',
	}),
	LAC: Type.String({
		minLength: 1,
		description: 'LAC',
		examples: '2305',
	}),
	'Link Quality': Type.String({
		minLength: 1,
		description: 'Link Quality',
		examples: '0',
	}),
	'Network Bearer': Type.String({
		minLength: 1,
		description: 'Network Bearer',
		examples: '6',
	}),
	'Radio Signal Strength': Type.String({
		minLength: 1,
		description: 'Radio Signal Strength',
		examples: '-97',
	}),
	SMCC: Type.String({
		minLength: 1,
		description:
			'Serving Mobile Country Code. This is applicable when the Network Bearer Resource value is referring to a cellular network.',
		examples: '242',
	}),
	SMNC: Type.String({
		minLength: 1,
		description:
			'Serving Mobile Network Code. This is applicable when the Network Bearer Resource value is referring to a cellular network.',
		examples: '2',
	}),
	SignalSNR: Type.String({
		minLength: 1,
		description:
			'SINR: Signal to Interference plus Noise Ratio SINR is the ratio of the strength of the received signal to the strength of the received interference signal (noise and interference).',
		examples: '0',
	}),
})

/**
 * ECID-Signal Measurement Information
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/10256.xml
 */
export const ECIDSignalMeasurementInformation = Type.Object({
	ECGI: Type.String({
		minLength: 1,
		description: 'ECGI',
		examples: ['0'],
	}),
	arfcnEUTRA: Type.String({
		minLength: 1,
		description: 'arfcnEUTRA',
		examples: ['6300', '0'],
	}),
	physCellId: Type.String({
		minLength: 1,
		description: 'physCellId',
		examples: ['1187', '188'],
	}),
	'rsrp-Result': Type.String({
		minLength: 1,
		description: 'rsrp-Result',
		examples: ['-98', '0'],
	}),
	'rsrq-Result': Type.String({
		minLength: 1,
		description:
			'This field specifies the reference signal received power (RSRP) measurement.',
		examples: ['-14', '-13', '0'],
	}),
	'ue-RxTxTimeDiff': Type.String({
		minLength: 1,
		description: 'ue-RxTxTimeDiff',
		examples: ['0'],
	}),
})

/**
 * Location Assistance
 * TODO: add link documentation
 */
const locationAssistance = Type.Object({
	'A-GPS assistance mask': Type.String({
		minLength: 1,
		description: 'A-GPS assistance mask',
		examples: '0',
	}),
	'Assistance type': Type.String({
		minLength: 1,
		description: 'Assistance type',
		examples: '4',
	}),
	'P-GPS predictionCount': Type.String({
		minLength: 1,
		description: 'P-GPS predictionCount',
		examples: '0',
	}),
	'P-GPS predictionIntervalMinutes': Type.String({
		minLength: 1,
		description: 'P-GPS predictionIntervalMinutes',
		examples: '0',
	}),
	'P-GPS startGpsDay': Type.String({
		minLength: 1,
		description: 'P-GPS startGpsDay',
		examples: '0',
	}),
	'P-GPS startGpsTimeOfDaySeconds': Type.String({
		minLength: 1,
		description: 'P-GPS startGpsTimeOfDaySeconds',
		examples: '0',
	}),
	accuracy: Type.String({
		minLength: 1,
		description: 'accuracy',
		examples: '12500.0',
	}),
	assistance_data: noValue,
	altitude: noValue,
	latitude: Type.String({
		minLength: 1,
		description: 'latitude',
		examples: '63.42154',
	}),
	longitude: Type.String({
		minLength: 1,
		description: 'longitude',
		examples: '10.432',
	}),
	'result code': noValue,
})

/**
 * Configuration
 * TODO: add link documentation
 */
export const configuration = Type.Object({
	'Accelerometer activity threshold': Type.String({
		minLength: 1,
		description:
			'Accelerometer Activity Threshold in m/s²: Minimal absolute value for an accelerometer reading to be considered movement.',
		examples: '10.0',
	}),
	'Accelerometer inactivity threshold': Type.String({
		minLength: 1,
		description:
			'Accelerometer Inactivity Threshold in m/s²: Maximum absolute value for an accelerometer reading to be considered stillness. Should be lower than the activity threshold.',
		examples: '5.0',
	}),
	'Accelerometer inactivity timeout': Type.String({
		minLength: 1,
		description:
			'Accelerometer Inactivity Timeout in s: Hysteresis timeout for stillness detection.',
		examples: '60.0',
	}),
	'Active wait time': Type.String({
		minLength: 1,
		description: 'Assistance type', // TODO: get custom description
		examples: '120',
	}),
	'GNSS enable': Type.String({
		minLength: 1,
		description: 'Assistance type', // TODO: get custom description
		examples: 'true',
	}),
	'GNSS timeout': Type.String({
		minLength: 1,
		description: 'GNSS timeout (in seconds): Timeout for GNSS fix.',
		examples: '30',
	}),
	'Movement resolution': Type.String({
		minLength: 1,
		description:
			'(movement resolution) In passive mode: After detecting movement send an update and wait this amount of time until movement again can trigger the next update.',
		examples: '120',
	}),
	'Movement timeout': Type.String({
		minLength: 1,
		description:
			'(movement timeout) In passive mode: Send update at least this often (in seconds).',
		examples: '3600',
	}),
	'Neighbor cell measurements enable': Type.String({
		minLength: 1,
		description: 'Neighbor cell measurements enable', // TODO: get custom description
		examples: 'true',
	}),
	'Passive mode': Type.String({
		minLength: 1,
		description: 'Passive mode',
		examples: 'false',
	}),
})

/**
 * Device
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/3.xml
 */
export const device = Type.Object({
	'Available Power Sources': Type.Union([
		Type.Object({
			'0': availablePowerSources,
			'1': availablePowerSources,
		}),
		Type.Object({}),
	]),
	'Error Code': Type.Object({
		'0': Type.String({
			minLength: 1,
			description: 'Error Code',
			examples: '0',
		}),
	}),
	ExtDevInfo: Type.Object({}),
	// NOTE: Option 1
	'Power Source Current': Type.Union([
		Type.Object({
			'0': powerSourceCurrent,
			'1': powerSourceCurrent,
		}),
		Type.Object({}),
	]),
	// NOTE: Option 2
	'Power Source Voltage': Type.Object({
		'0': Type.Optional(powerSourceVoltage),
		'1': Type.Optional(powerSourceVoltage),
	}),
	// NOTE: options to describe { key: {} | something}
	// Recomended is option 1: https://github.com/sinclairzx81/typebox/issues/29
	'Battery Level': Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Battery Status': Type.Union([
		Type.String({
			minLength: 1,
			description: 'Battery Status',
			examples: '1',
		}),
		noValue,
	]),
	'Current Time': Type.String({
		minLength: 1,
		description: 'Current UNIX time of the LwM2M Client.',
		examples: '2022-10-03T12:18:40Z',
	}),
	'Device Type': Type.String({
		minLength: 1,
		description: 'Device Type',
		examples: 'OMA-LWM2M Client',
	}),
	'Factory Reset': Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Firmware Version': Type.String({
		minLength: 1,
		description:
			'Current firmware version of the Device.The Firmware Management function could rely on this resource.',
		examples: 'mfw_nrf9160_1.3.1',
	}),
	'Hardware Version': Type.String({
		minLength: 1,
		description: 'Current hardware version of the device',
		examples: 'nRF9160_SICA',
	}),
	Manufacturer: Type.String({
		minLength: 1,
		description: 'Manufacturer',
		examples: 'Nordic Semiconductor ASA',
	}),
	'Memory Free': Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Memory Total': Type.Union([
		Type.String({
			minLength: 1,
			description: 'Memory Total',
			examples: '448',
		}),
		noValue,
	]),
	'Model Number': Type.String({
		minLength: 1,
		description: 'Model Number',
		examples: 'nrf9160dk_nrf9160',
	}),
	Reboot: Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Reset Error Code': Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Serial Number': Type.String({
		minLength: 1,
		description: 'Serial Number',
		examples: '351358811128922',
	}),
	'Software Version': Type.String({
		minLength: 1,
		description:
			'Current software version of the device (manufacturer specified string).',
		examples: '2.0.2',
	}),
	'Supported Binding and Modes': Type.String({
		minLength: 1,
		description: 'Supported Binding and Modes',
		examples: 'U',
	}),
	Timezone: Type.String({
		minLength: 1,
		description: 'Timezone',
		examples: '',
	}),
	'UTC Offset': Type.String({
		minLength: 1,
		description: 'UTC Offset',
		examples: '',
	}),
})

/**
 * Firmware Update
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/5.xml
 */
const firmwareUpdate = Type.Object({
	'Firmware Update Protocol Support': Type.Object({}),
	'Firmware Update Delivery Method': Type.String({
		minLength: 1,
		description: 'Firmware Update Delivery Method',
		examples: ['2'],
	}),
	Package: Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Package URI': Type.String({
		minLength: 1,
		description: 'Package URI',
		examples: [''],
	}),
	PkgName: Type.String({
		minLength: 1,
		description: 'PkgName',
		examples: [''],
	}),
	PkgVersion: Type.String({
		minLength: 1,
		description: 'PkgVersion',
		examples: [''],
	}),
	State: Type.String({
		minLength: 1,
		description: 'State',
		examples: ['0'],
	}),
	Update: Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Update Result': Type.String({
		minLength: 1,
		description: 'Update Result',
		examples: ['1'],
	}),
})

/**
 * Humidity
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/3304.xml
 */
export const humidity = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': Type.Union([
		measurementQualityIndicador,
		noValue,
	]),
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Measured Value': minMeasuredValue,
	'Min Range Value': minRangeValue,
	'Reset Min and Max Measured Values': noValue,
	'Sensor Units': sensorUnits,
	'Sensor Value': sensorValue,
	Timestamp: timestamp,
})

/**
 * Location
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/6.xml
 */
const location = Type.Object({
	Altitude: Type.String({
		minLength: 1,
		description: 'Altitude',
		examples: '0.0',
	}),
	Latitude: Type.String({
		minLength: 1,
		description: 'Latitude',
		examples: '0.0',
	}),
	Longitude: Type.String({
		minLength: 1,
		description: 'Longitude',
		examples: '0.0',
	}),
	Radius: Type.String({
		minLength: 1,
		description: 'Radius',
		examples: '0.0',
	}),
	Speed: Type.String({
		minLength: 1,
		description: 'Speed',
		examples: '0.0',
	}),
	Timestamp: timestamp,
	Velocity: Type.String({
		minLength: 1,
		description: 'Velocity',
		examples: '',
	}),
})

/**
 * LwM2M Server
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/1.xml
 */
const LwM2MServer = Type.Object({
	'APN Link': noValue,
	Binding: Type.String({
		minLength: 1,
		description: 'Binding',
		examples: 'U',
	}),
	'Bootstrap on Registration Failure': noValue,
	'Bootstrap-Request Trigger': noValue,
	'Communication Retry Count': noValue,
	'Communication Retry Timer': noValue,
	'Communication Sequence Delay Timer': noValue,
	'Communication Sequence Retry Count': noValue,
	'Default Maximum Period': Type.String({
		minLength: 1,
		description: 'Default Maximum Period',
		examples: '300',
	}),
	'Default Minimum Period': Type.String({
		minLength: 1,
		description: 'Default Minimum Period',
		examples: '1',
	}),
	Disable: noValue,
	'Disable Timeout': Type.String({
		minLength: 1,
		description: 'Disable Timeout',
		examples: '86400',
	}),
	'Initial Registration Delay Timer': noValue,
	'Last Bootstrapped': noValue,
	Lifetime: Type.String({
		minLength: 1,
		description: 'Lifetime',
		examples: '30',
	}),
	'Mute Send': Type.String({
		minLength: 1,
		description: 'Mute Send',
		examples: 'false',
	}),
	'Notification Storing When Disabled or Offline': Type.String({
		minLength: 1,
		description: 'Default Minimum Period',
		examples: 'false',
	}),
	'Preferred Transport': Type.String({
		minLength: 1,
		description: 'Notification Storing When Disabled or Offline',
		examples: '',
	}),
	'Registration Failure Block': noValue,
	'Registration Priority Order': noValue,
	'Registration Update Trigger': noValue,
	'Short Server ID': Type.String({
		minLength: 1,
		description: 'Short Server ID',
		examples: '101',
	}),
	'TLS-DTLS Alert Code': noValue,
	Trigger: noValue,
})

/**
 * Pressure
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/3323.xml
 */
export const pressure = Type.Object({
	'Application Type': applicationType,
	'Current Calibration': noValue,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': Type.Union([
		measurementQualityIndicador,
		noValue,
	]),
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Measured Value': minMeasuredValue,
	'Min Range Value': minRangeValue,
	'Reset Min and Max Measured Values': noValue,
	'Sensor Units': sensorUnits,
	'Sensor Value': sensorValue,
	Timestamp: timestamp,
})

/**
 * Push Button
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/3347.xml
 */
const pushButton = Type.Object({
	'Application Type': applicationType,
	'Digital Input Counter': Type.String({
		minLength: 1,
		description: 'Digital Input Counter',
		examples: '0',
	}),
	'Digital Input State': Type.String({
		minLength: 1,
		description: 'Digital Input State',
		examples: 'false',
	}),
	'Fractional Timestamp': noValue,
	Timestamp: timestamp,
})

/**
 * Temperature
 * @see https://github.com/OpenMobileAlliance/lwm2m-registry/blob/prod/3303.xml
 */
export const temperature = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': Type.Union([
		measurementQualityIndicador,
		noValue,
	]),
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Measured Value': minMeasuredValue,
	'Min Range Value': minRangeValue,
	'Reset Min and Max Measured Values': noValue,
	'Sensor Units': sensorUnits,
	'Sensor Value': sensorValue,
	Timestamp: timestamp,
})

export const coioteShadow = Type.Object({
	state: Type.Object({
		reported: Type.Object({
			'Connectivity Monitoring': Type.Object({
				'0': connectivityMonitoring,
			}),
			'ECID-Signal Measurement Information': Type.Object({
				'0': ECIDSignalMeasurementInformation,
				'1': ECIDSignalMeasurementInformation,
				'2': ECIDSignalMeasurementInformation,
			}),
			'Location Assistance': Type.Object({
				'0': locationAssistance,
			}),
			Configuration: Type.Object({
				'0': configuration,
			}),
			Device: Type.Object({
				'0': device,
			}),
			'Firmware Update': Type.Object({
				'0': firmwareUpdate,
			}),
			Humidity: Type.Object({
				'0': humidity,
			}),
			Location: Type.Object({
				'0': location,
			}),
			'LwM2M Server': Type.Object({ '0': LwM2MServer }),
			Pressure: Type.Object({
				'0': pressure,
			}),
			'Push button': Type.Object({
				'0': pushButton,
			}),
			Temperature: Type.Object({
				'0': temperature,
			}),
		}),
	}),
})
