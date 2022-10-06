import { Type } from '@sinclair/typebox'

const fractionalTimestamp = Type.Object(
	Type.Boolean({
		description: 'Fractional Timestamp',
	}),
)

const measurementQualityLevel = Type.Object(
	Type.Boolean({
		description: 'Measurement Quality Level',
	}),
)

const measurementQualityIndicador = Type.String({
	minLength: 1,
	description: 'Measurement Quality Indicator',
	examples: '0',
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

const timestamp = Type.String({
	minLength: 1,
	description: 'Timestamp',
	examples: ['2022-10-03T12:18:41Z', '1970-01-01T00:00:00Z'],
})

const sensorUnits = Type.String({
	minLength: 1,
	description: 'Sensor Units',
	examples: ['m/s^2', 'RGB-IR', 'Ω', '', 'kPa', '°C'],
})

const minRangeValue = Type.String({
	minLength: 1,
	examples: ['-19.6133', '0.0'],
})

const maxRangeValue = Type.String({
	minLength: 1,
	description: 'Max Range Value',
	examples: ['19.6133', '1000000.0', '100.0'],
})

const colourType = Type.String({
	minLength: 1,
	description: 'Colour',
	examples: ['0x507146FF', '0xFF50FF44', ''],
})

const maxMeasuredValue = Type.String({
	minLength: 1,
	description: 'Max Measured Value',
	examples: ['10350.0', '51.197021'],
})

const minMeasuredValue = Type.String({
	minLength: 1,
	description: 'Max Measured Value',
	examples: ['10350.0', '51.197021'],
})

const noValue = Type.Object({
	noValue: Type.Boolean({
		description: 'noValue',
	}),
})

const sensorValue = Type.String({
	minLength: 1,
	description: 'Sensor Value',
	examples: ['10350.0'],
})

const lightControl = Type.Object({
	'Application Type': applicationType,
	Colour: colourType,
	'Cumulative active power': Type.String({
		minLength: 1,
		description: 'Cumulative active power',
		examples: '0.0',
	}),
	Dimmer: Type.String({
		minLength: 1,
		description: 'Dimmer',
		examples: '100',
	}),
	'On time': Type.String({
		minLength: 1,
		description: 'On time',
		examples: '0',
	}),
	'On/Off': Type.String({
		minLength: 1,
		description: 'On/Off',
		examples: ['false'],
	}),
	'Power factor': Type.String({
		minLength: 1,
		description: 'Power factor',
		examples: '0.0',
	}),
	'Sensor Units': sensorUnits,
})

/**
 * Accelerometer
 */
const accelerometer = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': measurementQualityIndicador,
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Range Value': minRangeValue,
	'Sensor Units': sensorUnits,
	Timestamp: timestamp,
	'X Value': Type.String({
		minLength: 1,
		description: 'X Value',
		examples: '6.132514',
	}),
	'Y Value': Type.String({
		minLength: 1,
		description: 'Y Value',
		examples: '6.144473',
	}),
	'Z Value': Type.String({
		minLength: 1,
		description: 'Z Value',
		examples: '6.156431',
	}),
})

/**
 * Colour
 */
const colour = Type.Object({
	'Application Type': applicationType,
	Colour: colourType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Measurement Quality Indicator': measurementQualityIndicador,
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Sensor Units': sensorUnits,
	Timestamp: timestamp,
})

const availableNetworkBearer = Type.String({
	minLength: 1,
	description: 'Available Network Bearer',
	examples: ['6', '7'],
})

/**
 * Connectivity Monitoring
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
			description: 'IP Addresses',
			examples: '10.160.116.16t',
		}),
	}),
	'Router IP Addresses': Type.Object({}),
	'Cell ID': Type.String({
		minLength: 1,
		description: 'Cell ID',
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
		description: 'SMCC',
		examples: '242',
	}),
	SMNC: Type.String({
		minLength: 1,
		description: 'SMNC',
		examples: '2',
	}),
	SignalSNR: Type.String({
		minLength: 1,
		description: 'SignalSNR',
		examples: '0',
	}),
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

/**
 * Device
 */
export const device = Type.Object({
	'Available Power Sources': Type.Object({
		'0': availablePowerSources,
		'1': availablePowerSources,
	}),
	'Error Code': Type.Object({
		'0': Type.String({
			minLength: 1,
			description: 'Error Code',
			examples: '0',
		}),
	}),
	ExtDevInfo: Type.Object({}),
	'Power Source Current': Type.Object({
		'0': powerSourceCurrent,
		'1': powerSourceCurrent,
	}),
	'Power Source Voltage': Type.Object({
		'0': powerSourceVoltage,
		'1': powerSourceVoltage,
	}),
	'Battery Level': Type.Object({
		noValue: Type.Boolean({
			description: 'noValue',
		}),
	}),
	'Battery Status': Type.String({
		minLength: 1,
		description: 'Battery Status',
		examples: '1',
	}),
	'Current Time': Type.String({
		minLength: 1,
		description: 'Current Time',
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
		description: 'Firmware Version',
		examples: 'mfw_nrf9160_1.3.1',
	}),
	'Hardware Version': Type.String({
		minLength: 1,
		description: 'Hardware Version',
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
	'Memory Total': Type.String({
		minLength: 1,
		description: 'Memory Total',
		examples: '448',
	}),
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
		description: 'Software Version',
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
 * ECID-Signal Measurement Information
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
		description: 'rsrq-Result',
		examples: ['-14', '-13', '0'],
	}),
	'ue-RxTxTimeDiff': Type.String({
		minLength: 1,
		description: 'ue-RxTxTimeDiff',
		examples: ['0'],
	}),
})

/**
 * Firmware Update
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
 * Generic Sensor
 */
const genericSensor = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': measurementQualityIndicador,
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Measured Value': minMeasuredValue,
	'Min Range Value': minRangeValue,
	'Reset Min and Max Measured Values': noValue,
	'Sensor Type': Type.String({
		minLength: 1,
		description: 'Sensor Type',
		examples: 'Gas resistance sensor',
	}),
	'Sensor Units': sensorUnits,
	'Sensor Value': sensorValue,
	Timestamp: timestamp,
})

/**
 * Humidity
 */
const humidity = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': measurementQualityIndicador,
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
 * Location Assistance
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
 * LwM2M Server
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
 * On/Off switch
 */
const onOffSwitch = Type.Object({
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
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Off Time': Type.String({
		minLength: 1,
		description: 'Off Time',
		examples: '20',
	}),
	'On time': Type.String({
		minLength: 1,
		description: 'On time',
		examples: '0',
	}),
	Timestamp: timestamp,
})

/**
 * Pressure
 */
const pressure = Type.Object({
	'Application Type': applicationType,
	'Current Calibration': noValue,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': measurementQualityIndicador,
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
 */
const temperature = Type.Object({
	'Application Type': applicationType,
	'Fractional Timestamp': Type.Union([fractionalTimestamp, noValue]),
	'Max Measured Value': maxMeasuredValue,
	'Max Range Value': maxRangeValue,
	'Measurement Quality Indicator': measurementQualityIndicador,
	'Measurement Quality Level': Type.Union([measurementQualityLevel, noValue]),
	'Min Measured Value': minMeasuredValue,
	'Min Range Value': minRangeValue,
	'Reset Min and Max Measured Values': noValue,
	'Sensor Units': sensorUnits,
	'Sensor Value': sensorValue,
	Timestamp: timestamp,
})

/**
 * Portfolio
 */
const portfolio = Type.Object({
	AuthData: Type.Object({}),
	Identity: Type.Object({
		'0': Type.String({
			minLength: 1,
			description: '0',
			examples: 'Host Device ID #1',
		}),
		'1': Type.String({
			minLength: 1,
			description: '1',
			examples: 'Host Develce Manufacturer #1',
		}),
		'2': Type.String({
			minLength: 1,
			description: '2',
			examples: 'Host Device Model #1',
		}),
		'3': Type.String({
			minLength: 1,
			description: '3',
			examples: 'Host Device Software Version #1',
		}),
	}),
	AuthStatus: noValue,
	GetAuthData: noValue,
})

export const coioteShadow = Type.Object({
	state: Type.Object({
		reported: Type.Object({
			Accelerometer: Type.Object({
				'0': accelerometer,
			}),
			Colour: Type.Object({
				'0': colour,
				'1': colour,
			}),
			'Connectivity Monitoring': Type.Object({
				'0': connectivityMonitoring,
			}),
			Device: Type.Object({
				'0': device,
			}),
			'ECID-Signal Measurement Information': Type.Object({
				'0': ECIDSignalMeasurementInformation,
				'1': ECIDSignalMeasurementInformation,
				'2': ECIDSignalMeasurementInformation,
			}),
			'Firmware Update': Type.Object({
				'0': firmwareUpdate,
			}),
			'Generic Sensor': Type.Object({
				'0': genericSensor,
			}),
			Humidity: Type.Object({
				'0': humidity,
			}),
			'Light Control': Type.Object({
				'0': lightControl,
				'1': lightControl,
				'2': lightControl,
				'3': lightControl,
			}),
			Location: Type.Object({
				'0': location,
			}),
			'Location Assistance': Type.Object({
				'0': locationAssistance,
			}),
			'LwM2M Server': Type.Object({ '0': LwM2MServer }),
			'On/Off switch': Type.Object({
				'0': onOffSwitch,
				'1': onOffSwitch,
			}),
			Pressure: Type.Object({
				'0': pressure,
			}),
			'Push button': Type.Object({
				'0': pushButton,
				'1': pushButton,
			}),
			Temperature: Type.Object({
				'0': temperature,
			}),
			Portfolio: Type.Object({
				'0': portfolio,
			}),
		}),
	}),
})

/*

{
	state:
	{
		reported: {
			Accelerometer: {},
			Colour: {},
			'Connectivity Monitoring': {},
			Device: {},
			'ECID-Signal Measurement Information': {},
			'Firmware Update': {},
			'Generic Sensor': {},
			Humidity: {},
			'Light Control': {},
			Location: {},
			'Location Assistance': {},
			'LwM2M Server': {},
			'On/Off switch': {},
			Pressure: {},
			'Push button': {},
			Temperature: {},
			Portfolio: {},
		}
	}
}
*/
