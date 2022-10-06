import { Static, Type } from '@sinclair/typebox'

const ts = Type.Integer({
	minimum: 1234567890123,
	description: 'Timestamp as Unix epoch with millisecond precision (UTC)',
	examples: [1584533788029],
})
const lng = Type.Number({
	description: 'Longitude',
	minimum: -180,
	maximum: 180,
})
const lat = Type.Number({
	description: 'Latitude',
	minimum: -90,
	maximum: 90,
})
const acc = Type.Number({
	description: 'Accuracy (2D 1-sigma) in meters',
	minimum: 0,
})
export enum DataModules {
	GNSS = 'gnss',
	NeigboringCellMeasurements = 'ncell',
}

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/cfg.schema.json
 */
export const AssetConfig = Type.Object(
	{
		act: Type.Boolean({
			description: 'Whether to enable the active mode.',
			examples: [false],
		}),
		actwt: Type.Integer({
			description:
				'In active mode: Wait this amount of seconds until sending the next update. The actual interval will be this time plus the time it takes to get a GNSS fix.',
			minimum: 1,
			maximum: 2147483647,
			examples: [300],
		}),
		mvres: Type.Integer({
			description:
				'(movement resolution) In passive mode: After detecting movement send an update and wait this amount of time until movement again can trigger the next update.',
			minimum: 1,
			maximum: 2147483647,
			examples: [300],
		}),
		mvt: Type.Integer({
			description:
				'(movement timeout) In passive mode: Send update at least this often (in seconds).',
			minimum: 1,
			maximum: 2147483647,
			examples: [3600],
		}),
		gnsst: Type.Integer({
			description: 'GNSS timeout (in seconds): Timeout for GNSS fix.',
			minimum: 1,
			maximum: 2147483647,
			examples: [60],
		}),
		accath: Type.Number({
			description:
				'Accelerometer Activity Threshold in m/s²: Minimal absolute value for an accelerometer reading to be considered movement.',
			minimum: 0,
			maximum: 78.4532,
			examples: [10],
		}),
		accith: Type.Number({
			description:
				'Accelerometer Inactivity Threshold in m/s²: Maximum absolute value for an accelerometer reading to be considered stillness. Should be lower than the activity threshold.',
			minimum: 0,
			maximum: 78.4532,
			examples: [5],
		}),
		accito: Type.Number({
			description:
				'Accelerometer Inactivity Timeout in s: Hysteresis timeout for stillness detection.',
			minimum: 0.08,
			maximum: 5242.88,
			examples: [60],
		}),
		nod: Type.Array(Type.Enum(DataModules), {
			minItems: 0,
			description:
				'List of modules which should be disabled when sampling data.',
		}),
	},
	{ description: 'Configures the device' },
)

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json
 */
export const GNSS = Type.Object(
	{
		v: Type.Object({
			lng,
			lat,
			acc,
			alt: Type.Number({
				description: 'Altitude above WGS-84 ellipsoid in meters',
			}),
			spd: Type.Number({
				description: 'Horizontal speed in meters',
				minimum: 0,
			}),
			hdg: Type.Number({
				description: 'Heading of movement in degrees',
				minimum: 0,
				maximum: 360,
			}),
		}),
		ts,
	},
	{ description: 'Timestamp as Unix epoch with millisecond precision (UTC)' },
)

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json
 */
export const Battery = Type.Object(
	{
		v: Type.Number({
			description: 'Battery reading read by the modem',
			minimum: 1,
		}),
		ts,
	},
	{ description: 'Battery reading in millivolt' },
)

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json
 */
export const AssetInfo = Type.Object(
	{
		v: Type.Object({
			imei: Type.String({
				description: 'Board IMEI',
				minLength: 15,
				maxLength: 16,
				examples: ['352656106111232'],
			}),
			iccid: Type.String({
				description: 'SIM ICCID',
				minLength: 19,
				maxLength: 20,
				examples: ['89450421180216216095'],
			}),
			modV: Type.String({
				description: 'Modem Firmware Version',
				minLength: 1,
				examples: ['mfw_nrf9160_1.0.0'],
			}),
			brdV: Type.String({
				description: 'Board Version',
				minLength: 1,
				examples: ['thingy91_nrf9160'],
			}),
			// https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.aws.schema.json
			appV: Type.String({
				description: 'Application Firmware Version',
				minLength: 1,
				examples: ['v1.0.0-rc1-327-g6fc8c16b239f'],
			}),
		}),
		ts,
	},
	{
		description:
			'Static device information. This information shall be updated by the device once after reboot.',
	},
)

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json
 */
export const Roaming = Type.Object(
	{
		v: Type.Object({
			band: Type.Integer({ minimum: 1, description: 'Band', examples: [3] }),
			nw: Type.String({
				minLength: 1,
				description: 'Network mode',
				examples: ['LTE-M', 'NB-IoT'],
			}),
			rsrp: Type.Integer({
				description:
					'Reference Signal Received Power (RSRP). The average power level in dBm received from a single reference signal in an LTE (Long-term Evolution) network. Typically this value ranges from -140 to -40 dBm.',
				minimum: -140,
				maximum: -40,
				examples: [-97, -104],
			}),
			area: Type.Integer({
				description: 'Area code.',
				minimum: 1,
				examples: [12],
			}),
			mccmnc: Type.Integer({
				description: 'Mobile country code and mobile network code',
				minimum: 10000,
				maximum: 99999,
				examples: [24202],
			}),
			cell: Type.Integer({
				description: 'Cell id',
				minimum: 1,
				examples: [33703719],
			}),
			ip: Type.String({
				description: 'IP address',
				minLength: 1,
				examples: [
					'10.81.183.99',
					'2001:0db8:85a3:0000:0000:8a2e:0370:7334',
					'2001:db8:85a3::8a2e:370:7334',
				],
			}),
		}),
		ts,
	},
	{
		description:
			'Roaming information. This information shall be updated by the device every time it publishes primary application data. It is considered low-priority information so it should always be sent after the primary application data has been published.',
	},
)

/**
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/eb5e212ecb15ad52ae891162085af02f7b244d9a/docs/cloud-protocol/state.reported.schema.json
 */
export const Environment = Type.Object(
	{
		v: Type.Object(
			{
				temp: Type.Number({
					description: 'Temperature reading from external sensor',
				}),
				hum: Type.Number({
					description: 'Humidity reading from external sensor',
					minimum: 1,
					maximum: 100,
				}),
				atmp: Type.Number({
					description:
						'Atmospheric pressure reading from external sensor in kPa',
					minimum: 0,
				}),
			},
			{ description: 'The individual sensor readings' },
		),
		ts,
	},
	{ description: 'Environment sensor readings' },
)

export type AssetState = {
	cfg?: Static<typeof AssetConfig>
}

export type ReportedState = AssetState & {
	gnss?: Static<typeof GNSS>
	bat?: Static<typeof Battery>
	dev?: Static<typeof AssetInfo>
	roam?: Static<typeof Roaming>
	env?: Static<typeof Environment>
}

/**
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-shadow-document.html#device-shadow-example-response-json
 */
export type assetTrackerShadow = {
	state: {
		reported: ReportedState
	}
}

/*
state: {
	reported: {
		gnss: {},
		bat: {},
		dev: {},
		roam: {},
		env: {},
	}
}
*/
