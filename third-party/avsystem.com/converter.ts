import { Static } from '@sinclair/typebox'
import {
	AssetConfig,
	AssetInfo,
	assetTrackerShadow,
	Battery,
	Environment,
	Roaming,
} from './types/assetTrackerShadow'
import {
	coioteShadow,
	connectivityMonitoring,
	device as dev,
	ECIDSignalMeasurementInformation,
} from './types/coioteShadow'

/**
 * transform shadow from 'coiote' type to 'nrf asset tracker' type
 */
export const converter = (
	coiote: Static<typeof coioteShadow>,
): assetTrackerShadow => {
	// TODO: discover this values
	// Asset Config
	const act = true
	const actwt = 1
	const mvres = 1
	const mvt = 1
	const gnsst = 1
	const accath = 1
	const accith = 1
	const accito = 1
	const nod: any[] = []
	const cfg = generateAssetConfig(
		act,
		actwt,
		mvres,
		mvt,
		gnsst,
		accath,
		accith,
		accito,
		nod,
	)

	// Asset Info
	const device = coiote.state.reported.Device['0']
	const assetInfo = generateAssetInfo(device)

	// Roaming
	const ecidSignal =
		coiote.state.reported['ECID-Signal Measurement Information']['0']
	const connectivityMonitoring =
		coiote.state.reported['Connectivity Monitoring']['0']
	const roam = generateRoaming(ecidSignal, connectivityMonitoring)

	// Enviroment
	const temperature = coiote.state.reported.Temperature['0']
	const humidity = coiote.state.reported.Humidity['0']
	const pressure = coiote.state.reported.Pressure['0']
	const temp = Number(temperature['Sensor Value'])
	const hum = Number(humidity['Sensor Value'])
	const atmp = Number(pressure['Sensor Value'])
	const tsEnviroment = 1
	const env = generateEnviroment(temp, hum, atmp, tsEnviroment)

	// Batery
	const v = 1
	const tsBatery = 1
	const bat = generateBatery(v, tsBatery)

	const result = {
		state: {
			reported: {
				cfg,
				dev: assetInfo,
				roam,
				env,
				bat,
			},
		},
	}

	return result
}

//
export const generateEnviroment = (
	temp: number,
	hum: number,
	atmp: number,
	ts: number,
): Static<typeof Environment> => {
	return {
		v: {
			temp,
			hum,
			atmp,
		},
		ts,
	}
}

export const generateBatery = (
	v: number,
	ts: number,
): Static<typeof Battery> => {
	return {
		v,
		ts,
	}
}

export const generateRoaming = (
	ecidSignal: Static<typeof ECIDSignalMeasurementInformation>,
	connectivityMonitoringParam: Static<typeof connectivityMonitoring>,
): Static<typeof Roaming> => {
	const band = 1
	const nw = '1'
	const rsrp = Number(ecidSignal['rsrp-Result'])
	const area = 1
	const mccmnc = Number(
		`${connectivityMonitoringParam.SMCC}${connectivityMonitoringParam.SignalSNR}${connectivityMonitoringParam.SMNC}`,
	)
	const cell = Number(connectivityMonitoringParam['Cell ID'])
	const ip = connectivityMonitoringParam['IP Addresses']['0']
	const ts = 1

	return {
		v: {
			band,
			nw,
			rsrp,
			area,
			mccmnc,
			cell,
			ip,
		},
		ts,
	}
}

export const generateAssetInfo = (
	devideParam: Static<typeof dev>,
): Static<typeof AssetInfo> => {
	const imei = devideParam['Serial Number']
	const iccid = ''
	const modV = devideParam['Firmware Version']
	const brdV = devideParam['Hardware Version']
	const appV = devideParam['Software Version']
	const ts = 1
	return {
		v: {
			imei,
			iccid,
			modV,
			brdV,
			appV,
		},
		ts,
	}
}

export const generateAssetConfig = (
	act: boolean,
	actwt: number,
	mvres: number,
	mvt: number,
	gnsst: number,
	accath: number,
	accith: number,
	accito: number,
	nod: any[],
): Static<typeof AssetConfig> => {
	return {
		act,
		actwt,
		mvres,
		mvt,
		gnsst,
		accath,
		accith,
		accito,
		nod,
	}
}
