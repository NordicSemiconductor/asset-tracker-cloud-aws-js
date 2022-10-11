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
	coioteShadow as coioteShadowType,
	configuration,
	connectivityMonitoring,
	device as dev,
	ECIDSignalMeasurementInformation,
	humidity as humidityType,
	pressure as pressureType,
	temperature as temperatureType,
} from './types/coioteShadow'

/**
 * Receving a Coiote data type shadow (@see https://developer.nordicsemi.com/nRF_Connect_SDK/doc/2.0.0/nrf/applications/asset_tracker_v2/doc/cloud_wrapper.html#lwm2m-objects)
 * find the equivalent values between Coiote's shadow and nRF Asset Tracker's shadow,
 * and returns a new shadow with the nRF Asset Tracker data type (@see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json)
 *
 * @param coioteShadow
 * @returns nrfSahdow
 */
export const converter = (
	coioteShadow: Static<typeof coioteShadowType>,
): assetTrackerShadow => {
	// Asset Config
	const configuration = coioteShadow.state.reported.Configuration['0']
	const cfg = generateAssetConfig(configuration)

	// Asset Info
	const device = coioteShadow.state.reported.Device['0']
	const assetInfo = generateAssetInfo(device)

	// Roaming
	const ecidSignal =
		coioteShadow.state.reported['ECID-Signal Measurement Information']['0']
	const connectivityMonitoring =
		coioteShadow.state.reported['Connectivity Monitoring']['0']
	const roam = generateRoaming(ecidSignal, connectivityMonitoring)

	// Enviroment
	const temperature = coioteShadow.state.reported.Temperature['0']
	const humidity = coioteShadow.state.reported.Humidity['0']
	const pressure = coioteShadow.state.reported.Pressure['0']
	const tsEnviroment = 1
	const env = generateEnviroment(temperature, humidity, pressure, tsEnviroment)

	// Batery
	const v = 1
	const tsBatery = 1
	const bat = generateBatery(v, tsBatery)

	const nrfSahdow = {
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

	return nrfSahdow
}

/**
 * Find equivalent values from Coiote's shadow to generate the enviroment section (env) in nRF Asset Tracker shadow
 * @param temperature
 * @param humidity
 * @param pressure
 * @param ts
 * @returns env
 */
export const generateEnviroment = (
	temperature: Static<typeof temperatureType>,
	humidity: Static<typeof humidityType>,
	pressure: Static<typeof pressureType>,
	ts: number,
): Static<typeof Environment> => {
	const temp = Number(temperature['Sensor Value'])
	const hum = Number(humidity['Sensor Value'])
	const atmp = Number(pressure['Sensor Value'])

	const env = {
		v: {
			temp,
			hum,
			atmp,
		},
		ts,
	}
	return env
}

/**
 * *Find equivalent values from Coiote's shadow to generate the batery section (bat) in nRF Asset Tracker shadow
 * @param v
 * @param ts
 * @returns bat
 */
export const generateBatery = (
	v: number,
	ts: number,
): Static<typeof Battery> => {
	const bat = {
		v,
		ts,
	}
	return bat
}

/**
 * Find equivalent values from Coiote's shadow to generate the roaming section (roam) in nRF Asset Tracker shadow
 * @param ecidSignal
 * @param connectivityMonitoringParam
 * @returns roam
 */
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

	const roam = {
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
	return roam
}

/**
 * Find equivalent values from Coiote's shadow to generate the asset info section (dev) in nRF Asset Tracker shadow
 * @param devideParam
 * @returns dev
 */
export const generateAssetInfo = (
	devideParam: Static<typeof dev>,
): Static<typeof AssetInfo> => {
	const imei = devideParam['Serial Number']
	const iccid = '' //TODO: find value
	const modV = devideParam['Firmware Version']
	const brdV = devideParam['Hardware Version']
	const appV = devideParam['Software Version']
	const ts = 1 // TODO: find value
	const dev = {
		v: {
			imei,
			iccid,
			modV,
			brdV,
			appV,
		},
		ts,
	}
	return dev
}

/**
 * Find equivalent values from Coiote's shadow to generate the configuration section (cfg) in nRF Asset Tracker shadow
 * @param config
 * @returns cfg
 */
export const generateAssetConfig = (
	config: Static<typeof configuration>,
): Static<typeof AssetConfig> => {
	const act = true // TODO: find value
	const actwt = Number(config['Accelerometer inactivity threshold'])
	const mvres = Number(config['Movement resolution'])
	const mvt = Number(config['Movement timeout'])
	const gnsst = Number(config['GNSS timeout'])
	const accath = Number(config['Accelerometer activity threshold'])
	const accith = Number(config['Accelerometer inactivity threshold'])
	const accito = Number(config['Accelerometer inactivity timeout'])
	const nod: any[] = []

	const cfg = {
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
	return cfg
}
