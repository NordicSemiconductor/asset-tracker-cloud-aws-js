import { Type } from '@sinclair/typebox'

const RSRP = Type.Integer({
	minimum: -157,
	maximum: -44,
	title:
		'RSRP: Reference Signal Received Power. Measured in dBm. See this page for more details. Range -157..-44',
})
const RSRQ = Type.Number({
	minimum: -34.5,
	maximum: 3.5,
	title:
		'RSRQ: Reference Signal Received Quality. Measured in dB. See this page for more details. Range -34.5..3.5',
})
const TimingAdvance = Type.Integer({
	minimum: -34.5,
	maximum: 65535,
	title:
		'TimingAdvance: The length of time a signal takes to reach the base station from a mobile phone (half of rtt=round trip time). The units are symbols (Ts) as specified in 3GPP TS 36.211 (LTE). The expected resolution for nRF Cloud API is 1 Ts. Range 0..20512. 65535 is reported if timing advance cannot be determined.',
})
const EARFCN = Type.Integer({
	description:
		'Evolved Absolute Radio Frequency Channel (E-ARFCN). Range: 0..262143',
	minimum: 0,
	maximum: 262143,
})
const PCI = Type.Integer({
	description: 'Physical Cell Identity (PCI). Range: 0..503',
	minimum: 0,
	maximum: 504,
})

const neighboringCellsSurvey = Type.Array(
	Type.Object(
		{
			eci: Type.Integer({ minimum: 1 }),
			mcc: Type.Integer({ minimum: 100, maximum: 999 }),
			mnc: Type.Integer({ minimum: 1, maximum: 999 }),
			tac: Type.Integer({ minimum: 1 }),
			earfcn: Type.Optional(EARFCN),
			adv: Type.Optional(TimingAdvance),
			rsrp: Type.Optional(RSRP),
			rsrq: Type.Optional(RSRQ),
			nmr: Type.Optional(
				Type.Array(
					Type.Object(
						{
							pci: PCI,
							earfcn: EARFCN,
							rsrp: RSRP,
							rsrq: RSRQ,
						},
						{ additionalProperties: false },
					),
					{ minItems: 1 },
				),
			),
		},
		{ additionalProperties: false },
	),
	{ minItems: 1 },
)

const wifiSiteSurvey = Type.Object({
	accessPoints: Type.Array(
		Type.Object(
			{
				macAddress: Type.RegExp(/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i),
				age: Type.Optional(Type.Integer()),
				frequency: Type.Optional(Type.Number()),
				channel: Type.Optional(Type.Integer()),
				signalStrength: Type.Optional(
					Type.Integer({ minimum: -128, maximum: 0 }),
				),
				signalToNoiseRadio: Type.Optional(Type.Integer()),
				ssid: Type.Optional(Type.String()),
			},
			{ additionalProperties: false },
		),
		{
			minItems: 2,
		},
	),
})

/**
 * @see https://api.nrfcloud.com/v1#tag/Ground-Fix/operation/GetLocationFromCellTowersOrWifiNetworks
 */
export const groundFixRequestSchema = Type.Object(
	{
		lte: Type.Optional(neighboringCellsSurvey),
		wifi: Type.Optional(wifiSiteSurvey),
	},
	{
		additionalProperties: false,
	},
)
