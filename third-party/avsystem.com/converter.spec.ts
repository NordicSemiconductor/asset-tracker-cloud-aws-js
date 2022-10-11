import { Static } from '@sinclair/typebox'
import { converter } from './converter'
import { assetTrackerShadow } from './types/assetTrackerShadow'
import { coioteShadow } from './types/coioteShadow'

const assetTracker: assetTrackerShadow = {
	state: {
		reported: {
			cfg: {
				act: false,
				gnsst: 30,
				actwt: 5,
				mvres: 120,
				mvt: 3600,
				accath: 10,
				accith: 5,
				accito: 60,
				nod: [],
			},
			dev: {
				v: {
					imei: '351358811128922',
					iccid: '',
					modV: 'mfw_nrf9160_1.3.1',
					brdV: 'nRF9160_SICA',
					appV: '2.0.2',
				},
				ts: 1664799520,
			},
			roam: {
				v: {
					band: 1,
					nw: '1',
					rsrp: -98,
					area: 1,
					mccmnc: 24202,
					cell: 33703712,
					ip: '10.160.116.16',
				},
				ts: 1,
			},
			env: {
				v: {
					atmp: 97.453212,
					hum: 51.197021,
					temp: 21.107585,
				},
				ts: 1664799521,
			},
			bat: {
				v: 0,
				ts: 1664799520,
			},
		},
	},
}

const avSystemShadow: Static<typeof coioteShadow> = {
	state: {
		reported: {
			'Connectivity Monitoring': {
				'0': {
					APN: {
						'0': 'ibasis.iot',
					},
					'Available Network Bearer': {
						'0': '6',
						'1': '7',
					},
					'IP Addresses': {
						'0': '10.160.116.16',
					},
					'Router IP Addresses': {},
					'Cell ID': '33703712',
					LAC: '2305',
					'Link Quality': '0',
					'Network Bearer': '6',
					'Radio Signal Strength': '-97',
					SMCC: '242',
					SMNC: '2',
					SignalSNR: '0',
				},
			},
			Device: {
				'0': {
					'Available Power Sources': {
						'0': '1',
						'1': '5',
					},
					'Error Code': {
						'0': '0',
					},
					ExtDevInfo: {},
					'Power Source Current': {
						'0': '125',
						'1': '900',
					},
					'Power Source Voltage': {
						'0': '3800',
						'1': '5000',
					},
					'Battery Level': {
						noValue: true,
					},
					'Battery Status': '1',
					'Current Time': '2022-10-03T12:18:40Z',
					'Device Type': 'OMA-LWM2M Client',
					'Factory Reset': {
						noValue: true,
					},
					'Firmware Version': 'mfw_nrf9160_1.3.1',
					'Hardware Version': 'nRF9160_SICA',
					Manufacturer: 'Nordic Semiconductor ASA',
					'Memory Free': {
						noValue: true,
					},
					'Memory Total': '448',
					'Model Number': 'nrf9160dk_nrf9160',
					Reboot: {
						noValue: true,
					},
					'Reset Error Code': {
						noValue: true,
					},
					'Serial Number': '351358811128922',
					'Software Version': '2.0.2',
					'Supported Binding and Modes': 'U',
					Timezone: '',
					'UTC Offset': '',
				},
			},
			'ECID-Signal Measurement Information': {
				'0': {
					ECGI: '0',
					arfcnEUTRA: '6300',
					physCellId: '187',
					'rsrp-Result': '-98',
					'rsrq-Result': '-14',
					'ue-RxTxTimeDiff': '0',
				},
				'1': {
					ECGI: '0',
					arfcnEUTRA: '6300',
					physCellId: '188',
					'rsrp-Result': '-98',
					'rsrq-Result': '-13',
					'ue-RxTxTimeDiff': '0',
				},
				'2': {
					ECGI: '0',
					arfcnEUTRA: '0',
					physCellId: '0',
					'rsrp-Result': '0',
					'rsrq-Result': '0',
					'ue-RxTxTimeDiff': '0',
				},
			},
			'Firmware Update': {
				'0': {
					'Firmware Update Protocol Support': {},
					'Firmware Update Delivery Method': '2',
					Package: {
						noValue: true,
					},
					'Package URI': '',
					PkgName: '',
					PkgVersion: '',
					State: '0',
					Update: {
						noValue: true,
					},
					'Update Result': '1',
				},
			},
			Humidity: {
				'0': {
					'Application Type': 'Simulated Humidity Sensor',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '51.197021',
					'Max Range Value': '100.0',
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '51.197021',
					'Min Range Value': '0.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': '%',
					'Sensor Value': '51.197021',
					Timestamp: '2022-10-03T12:18:41Z',
				},
			},
			Location: {
				'0': {
					Altitude: '0.0',
					Latitude: '0.0',
					Longitude: '0.0',
					Radius: '0.0',
					Speed: '0.0',
					Timestamp: '1970-01-01T00:00:00Z',
					Velocity: '',
				},
			},
			'Location Assistance': {
				'0': {
					assistance_data: {
						noValue: true,
					},
					'A-GPS assistance mask': '0',
					'Assistance type': '4',
					'P-GPS predictionCount': '0',
					'P-GPS predictionIntervalMinutes': '0',
					'P-GPS startGpsDay': '0',
					'P-GPS startGpsTimeOfDaySeconds': '0',
					accuracy: '12500.0',
					altitude: {
						noValue: true,
					},
					latitude: '63.42154',
					longitude: '10.432',
					'result code': {
						noValue: true,
					},
				},
			},
			'LwM2M Server': {
				'0': {
					'APN Link': {
						noValue: true,
					},
					Binding: 'U',
					'Bootstrap on Registration Failure': {
						noValue: true,
					},
					'Bootstrap-Request Trigger': {
						noValue: true,
					},
					'Communication Retry Count': {
						noValue: true,
					},
					'Communication Retry Timer': {
						noValue: true,
					},
					'Communication Sequence Delay Timer': {
						noValue: true,
					},
					'Communication Sequence Retry Count': {
						noValue: true,
					},
					'Default Maximum Period': '300',
					'Default Minimum Period': '1',
					Disable: {
						noValue: true,
					},
					'Disable Timeout': '86400',
					'Initial Registration Delay Timer': {
						noValue: true,
					},
					'Last Bootstrapped': {
						noValue: true,
					},
					Lifetime: '30',
					'Mute Send': 'false',
					'Notification Storing When Disabled or Offline': 'false',
					'Preferred Transport': '',
					'Registration Failure Block': {
						noValue: true,
					},
					'Registration Priority Order': {
						noValue: true,
					},
					'Registration Update Trigger': {
						noValue: true,
					},
					'Short Server ID': '101',
					'TLS-DTLS Alert Code': {
						noValue: true,
					},
					Trigger: {
						noValue: true,
					},
				},
			},
			Pressure: {
				'0': {
					'Application Type': 'Simulated Pressure Sensor',
					'Current Calibration': {
						noValue: true,
					},
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '97.453212',
					'Max Range Value': '110.0',
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '97.453212',
					'Min Range Value': '30.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': 'kPa',
					'Sensor Value': '97.453212',
					Timestamp: '2022-10-03T12:18:41Z',
				},
			},
			'Push button': {
				'0': {
					'Application Type': 'Push button 1',
					'Digital Input Counter': '0',
					'Digital Input State': 'false',
					'Fractional Timestamp': {
						noValue: true,
					},
					Timestamp: '1970-01-01T00:00:00Z',
				},
			},
			Temperature: {
				'0': {
					'Application Type': 'Simulated Temperature Sensor',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '21.107585',
					'Max Range Value': '85.0',
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '21.107585',
					'Min Range Value': '-40.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': '°C',
					'Sensor Value': '21.107585',
					Timestamp: '2022-10-03T12:18:41Z',
				},
			},
			Configuration: {
				'0': {
					'Accelerometer activity threshold': '10.0',
					'Accelerometer inactivity threshold': '5.0',
					'Accelerometer inactivity timeout': '60.0',
					'Active wait time': '120',
					'GNSS enable': 'true',
					'GNSS timeout': '30',
					'Movement resolution': '120',
					'Movement timeout': '3600',
					'Neighbor cell measurements enable': 'true',
					'Passive mode': 'false',
				},
			},
		},
	},
}

/**
 *
 * Check if object sending by params is an instance of assetTrackerShadow
 * https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards
 * Other option could be make this custom Jest function https://dev.to/andyhaskell/making-custom-jest-assertion-matchers-in-javascript-and-typescript-15ij
 */
const isAssetTrackerType = (x: any): x is assetTrackerShadow => {
	return (
		(x as assetTrackerShadow).state !== undefined &&
		(x as assetTrackerShadow).state.reported !== undefined &&
		(x as assetTrackerShadow).state.reported.cfg !== undefined &&
		(x as assetTrackerShadow).state.reported.dev !== undefined &&
		(x as assetTrackerShadow).state.reported.roam !== undefined &&
		(x as assetTrackerShadow).state.reported.env !== undefined &&
		(x as assetTrackerShadow).state.reported.bat !== undefined
	)
}

describe('AV System', () => {
	it("should transform the received object in 'nRF Asset Tracker' shadow type", () => {
		const coioteShadow = avSystemShadow
		const nrfAssetTrackerShadow = assetTracker

		const shadow = converter(coioteShadow)

		expect(shadow).toEqual(nrfAssetTrackerShadow)
		expect(isAssetTrackerType(shadow)).toBe(true) // TODO: check this
	})
})
