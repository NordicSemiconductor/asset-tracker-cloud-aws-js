import type { Static } from '@sinclair/typebox'
import { assetTrackerShadow } from './types/assetTrackerShadow'
import { coioteShadow } from './types/coioteShadow'

/**
 * This file is temporal.
 * Is just to show an example of each shadow type
 */

const nrfAssetTrackerShadow: assetTrackerShadow = {
	state: {
		reported: {
			cfg: {
				act: true,
				gnsst: 30,
				actwt: 120,
				mvres: 120,
				mvt: 3600,
				accath: 10,
				accith: 10,
				accito: 10,
				nod: [],
			},
			dev: {
				v: {
					imei: '351358815340515', // device.Serial Number
					iccid: '8931080620054260217',
					modV: 'mfw_nrf9160_1.3.1', // device.Firmware Version
					brdV: 'thingy91_nrf9160', // device.Hardware Version
					appV: '0.0.0-development', // device.Software Version
				},
				ts: 1655296483610,
			},
			roam: {
				v: {
					band: 20,
					nw: 'LTE-M',
					rsrp: -90, // ECID-Signal Measurement Information.rsrp-Result
					area: 30401,
					mccmnc: 24201, // Connectivity Monitoring + SMCC + SignalSNR + SMNC
					cell: 21679616, // Connectivity Monitoring. Cell ID
					ip: '10.160.103.45', // Connectivity Monitoring. IP Addresses
				},
				ts: 1655296797625,
			},
			env: {
				v: {
					temp: 26.71, // Temperature.Sensor Value
					hum: 33.593, // Humidity.Sensor Value
					atmp: 100.694, // pressure.Sensor Value
				},
				ts: 1655296797600,
			},
			bat: {
				v: 4398, // device.batery level
				ts: 1655296798188,
			},
		},
	},
}

const coiote: Static<typeof coioteShadow> = {
	state: {
		reported: {
			'Connectivity Monitoring': {
				'0': {
					'Radio Signal Strength': '-96',
					'Cell ID': '21627653',
					SMNC: '1',
					SMCC: '242',
					LAC: '30401',
					APN: {
						'0': 'ibasis.iot',
					},
					'Available Network Bearer': {
						'0': '6',
						'1': '7',
					},
					'IP Addresses': {
						'0': '10.160.225.39',
					},
					'Router IP Addresses': {},
					'Link Quality': '0',
					'Network Bearer': '6',
					SignalSNR: '0',
				},
			},
			'ECID-Signal Measurement Information': {
				'0': {
					physCellId: '247',
					ECGI: '0',
					arfcnEUTRA: '6400',
					'rsrp-Result': '-96',
					'rsrq-Result': '-12',
					'ue-RxTxTimeDiff': '0',
				},
				'1': {
					physCellId: '425',
					ECGI: '0',
					arfcnEUTRA: '300',
					'rsrp-Result': '-115',
					'rsrq-Result': '-12',
					'ue-RxTxTimeDiff': '23',
				},
				'2': {
					physCellId: '195',
					ECGI: '0',
					arfcnEUTRA: '300',
					'rsrp-Result': '-119',
					'rsrq-Result': '-16',
					'ue-RxTxTimeDiff': '23',
				},
			},
			'Location Assistance': {
				'0': {
					'Assistance type': '4',
					'A-GPS assistance mask': '128',
					'P-GPS predictionCount': '0',
					'P-GPS predictionIntervalMinutes': '0',
					'P-GPS startGpsDay': '0',
					'P-GPS startGpsTimeOfDaySeconds': '0',
					accuracy: '526.0',
					altitude: {
						noValue: true,
					},
					assistance_data: {
						noValue: true,
					},
					latitude: '63.42061758',
					longitude: '10.43935061',
					'result code': {
						noValue: true,
					},
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
			Device: {
				'0': {
					'Available Power Sources': {},
					'Error Code': {
						'0': '0',
					},
					ExtDevInfo: {},
					'Power Source Current': {},
					'Power Source Voltage': {
						'0': '4113',
					},
					'Battery Level': {
						noValue: true,
					},
					'Battery Status': {
						noValue: true,
					},
					'Current Time': '2022-10-07T13:33:53Z',
					'Device Type': '',
					'Factory Reset': {
						noValue: true,
					},
					'Firmware Version': '0.0.0-development',
					'Hardware Version': 'nRF9160_SICA',
					Manufacturer: 'Nordic Semiconductor ASA',
					'Memory Free': {
						noValue: true,
					},
					'Memory Total': {
						noValue: true,
					},
					'Model Number': 'thingy91_nrf9160',
					Reboot: {
						noValue: true,
					},
					'Reset Error Code': {
						noValue: true,
					},
					'Serial Number': '351358815340515',
					'Software Version': 'mfw_nrf9160_1.3.2',
					'Supported Binding and Modes': 'U',
					Timezone: '',
					'UTC Offset': '',
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
					'Application Type': '',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '31.064',
					'Max Range Value': '100.0',
					'Measurement Quality Indicator': {
						noValue: true,
					},
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '31.064',
					'Min Range Value': '0.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': '%',
					'Sensor Value': '28.927',
					Timestamp: '2022-10-07T13:33:22Z',
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
					'Default Maximum Period': '0',
					'Default Minimum Period': '0',
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
					Lifetime: '43200',
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
					'Application Type': '',
					'Current Calibration': {
						noValue: true,
					},
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '98.236',
					'Max Range Value': '110.0',
					'Measurement Quality Indicator': {
						noValue: true,
					},
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '98.236',
					'Min Range Value': '30.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': 'kPa',
					'Sensor Value': '98.226',
					Timestamp: '2022-10-07T13:33:22Z',
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
					'Application Type': '',
					'Fractional Timestamp': {
						noValue: true,
					},
					'Max Measured Value': '23.51',
					'Max Range Value': '85.0',
					'Measurement Quality Indicator': {
						noValue: true,
					},
					'Measurement Quality Level': {
						noValue: true,
					},
					'Min Measured Value': '23.51',
					'Min Range Value': '-40.0',
					'Reset Min and Max Measured Values': {
						noValue: true,
					},
					'Sensor Units': 'Celsius degrees',
					'Sensor Value': '24.57',
					Timestamp: '2022-10-07T13:33:22Z',
				},
			},
		},
	},
}

console.log(nrfAssetTrackerShadow, coiote)
