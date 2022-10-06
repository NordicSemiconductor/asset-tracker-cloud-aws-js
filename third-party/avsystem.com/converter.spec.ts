import { Static } from '@sinclair/typebox'
import { converter } from './converter'
import { assetTrackerShadow } from './types/assetTrackerShadow'
import { coioteShadow } from './types/coioteShadow'

const assetTracker: assetTrackerShadow = {
	state: {
		reported: {
			cfg: {
				act: true,
				gnsst: 1, //30,
				actwt: 1, //120,
				mvres: 1, //120,
				mvt: 1, //3600,
				accath: 1, //10,
				accith: 1, //10,
				accito: 1, //10,
				nod: [],
			},
			dev: {
				v: {
					imei: '351358811128922', // '351358815340515', // device.Serial Number
					iccid: '', // '8931080620054260217',
					modV: 'mfw_nrf9160_1.3.1', //'mfw_nrf9160_1.3.1', // device.Firmware Version
					brdV: 'nRF9160_SICA', //'thingy91_nrf9160', // device.Hardware Version
					appV: '2.0.2', //'0.0.0-development', // device.Software Version
				},
				ts: 1, //1655296483610,
			},
			roam: {
				v: {
					band: 1, //20,
					nw: '1', //'LTE-M',
					rsrp: -98, // -90, // ECID-Signal Measurement Information.rsrp-Result
					area: 1, //30401,
					mccmnc: 24202, //24201, // Connectivity Monitoring + SMCC + SignalSNR + SMNC
					cell: 33703712, // 21679616, // Connectivity Monitoring. Cell ID
					ip: '10.160.116.16', //'10.160.103.45', // Connectivity Monitoring. IP Addresses
				},
				ts: 1, //1655296797625,
			},
			env: {
				v: {
					/*
					temp: 26.71, // Temperature.Sensor Value
					hum: 33.593, // Humidity.Sensor Value
					atmp: 100.694, // pressure.Sensor Value*/
					atmp: 97.453212,
					hum: 51.197021,
					temp: 21.107585,
				},
				ts: 1, //1655296797600,
			},
			bat: {
				v: 1, //4398, // device.batery level
				ts: 1, //1655296798188,
			},
		},
	},
}

const avSystemShadow: Static<typeof coioteShadow> = {
	state: {
		reported: {
			Accelerometer: {
				'0': {
					'Application Type': 'Simulated Accelerometer',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Range Value': '19.6133',
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Range Value': '-19.6133',
					'Sensor Units': 'm/s^2',
					Timestamp: '2022-10-03T12:18:41Z',
					'X Value': '6.132514',
					'Y Value': '6.144473',
					'Z Value': '6.156431',
				},
			},
			Colour: {
				'0': {
					'Application Type': 'Simulated Light Sensor',
					Colour: '0x507146FF',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Sensor Units': 'RGB-IR',
					Timestamp: '2022-10-03T12:18:41Z',
				},
				'1': {
					'Application Type': 'Simulated Colour Sensor',
					Colour: '0xFF50FF44',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Sensor Units': 'RGB-IR',
					Timestamp: '2022-10-03T12:18:41Z',
				},
			},
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
			'Generic Sensor': {
				'0': {
					'Application Type': 'Simulated Gas Resistance Sensor',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '10350.0',
					'Max Range Value': '1000000.0',
					'Measurement Quality Indicator': '0',
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '10350.0',
					'Min Range Value': '0.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Type': 'Gas resistance sensor',
					'Sensor Units': 'Ω',
					'Sensor Value': '10350.0',
					Timestamp: '2022-10-03T12:18:40Z',
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
			'Light Control': {
				'0': {
					'Application Type': 'GPIO LED controller',
					Colour: '',
					'Cumulative active power': '0.0',
					Dimmer: '100',
					'On time': '0',
					'On/Off': 'false',
					'Power factor': '0.0',
					'Sensor Units': '',
				},
				'1': {
					'Application Type': 'GPIO LED controller',
					Colour: '',
					'Cumulative active power': '0.0',
					Dimmer: '100',
					'On time': '0',
					'On/Off': 'false',
					'Power factor': '0.0',
					'Sensor Units': '',
				},
				'2': {
					'Application Type': 'GPIO LED controller',
					Colour: '',
					'Cumulative active power': '0.0',
					Dimmer: '100',
					'On time': '0',
					'On/Off': 'false',
					'Power factor': '0.0',
					'Sensor Units': '',
				},
				'3': {
					'Application Type': 'GPIO LED controller',
					Colour: '',
					'Cumulative active power': '0.0',
					Dimmer: '100',
					'On time': '0',
					'On/Off': 'false',
					'Power factor': '0.0',
					'Sensor Units': '',
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
			'On/Off switch': {
				'0': {
					'Application Type': 'On/Off Switch 1',
					'Digital Input Counter': '0',
					'Digital Input State': 'false',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Off Time': '20',
					'On time': '0',
					Timestamp: '1970-01-01T00:00:00Z',
				},
				'1': {
					'Application Type': 'On/Off Switch 2',
					'Digital Input Counter': '0',
					'Digital Input State': 'false',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Off Time': '20',
					'On time': '0',
					Timestamp: '1970-01-01T00:00:00Z',
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
				'1': {
					'Application Type': 'Push button 2',
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
			Portfolio: {
				'0': {
					AuthData: {},
					Identity: {
						'0': 'Host Device ID #1',
						'1': 'Host Develce Manufacturer #1',
						'2': 'Host Device Model #1',
						'3': 'Host Device Software Version #1',
					},
					AuthStatus: {
						noValue: true,
					},
					GetAuthData: {
						noValue: true,
					},
				},
			},
		},
	},
}

describe('AV System', () => {
	it("should transform the received object in 'nRF Asset Tracker' shadow type", () => {
		const coioteShadow = avSystemShadow
		const nrfAssetTrackerShadow = assetTracker

		const shadow = converter(coioteShadow)

		expect(shadow).toEqual(nrfAssetTrackerShadow)
		expect(typeof shadow).toEqual(typeof coioteShadow) // TODO: make it better
	})
})
