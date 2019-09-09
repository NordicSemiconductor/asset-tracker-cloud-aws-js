import {
	AthenaTableArrayFieldType,
	AthenaTableField,
	AthenaTableScalarFieldType,
	AthenaTableStructFieldType,
} from '@bifravst/athena-helpers'

/**
 * This defines the table structure for querying device data
 */
export const deviceMessagesFields: {
	[key: string]: AthenaTableField
} = {
	reported: {
		type: AthenaTableStructFieldType.struct,
		fields: {
			acc: {
				type: AthenaTableStructFieldType.struct,
				fields: {
					ts: {
						type: AthenaTableScalarFieldType.bigint,
					},
					v: {
						type: AthenaTableArrayFieldType.array,
						items: AthenaTableScalarFieldType.float,
					},
				},
			},
			bat: {
				type: AthenaTableStructFieldType.struct,
				fields: {
					ts: {
						type: AthenaTableScalarFieldType.bigint,
					},
					v: {
						type: AthenaTableScalarFieldType.int,
					},
				},
			},
			gps: {
				type: AthenaTableStructFieldType.struct,
				fields: {
					ts: {
						type: AthenaTableScalarFieldType.bigint,
					},
					v: {
						type: AthenaTableStructFieldType.struct,
						fields: {
							acc: {
								type: AthenaTableScalarFieldType.float,
							},
							alt: {
								type: AthenaTableScalarFieldType.float,
							},
							hdg: {
								type: AthenaTableScalarFieldType.float,
							},
							lat: {
								type: AthenaTableScalarFieldType.float,
							},
							lng: {
								type: AthenaTableScalarFieldType.float,
							},
							spd: {
								type: AthenaTableScalarFieldType.float,
							},
						},
					},
				},
			},
			dev: {
				type: AthenaTableStructFieldType.struct,
				fields: {
					ts: {
						type: AthenaTableScalarFieldType.bigint,
					},
					v: {
						type: AthenaTableStructFieldType.struct,
						fields: {
							band: {
								type: AthenaTableScalarFieldType.int,
							},
							nw: {
								type: AthenaTableScalarFieldType.string,
							},
							iccid: {
								type: AthenaTableScalarFieldType.string,
							},
							modV: {
								type: AthenaTableScalarFieldType.string,
							},
							brdV: {
								type: AthenaTableScalarFieldType.string,
							},
							appV: {
								type: AthenaTableScalarFieldType.string,
							},
						},
					},
				},
			},
			roam: {
				type: AthenaTableStructFieldType.struct,
				fields: {
					ts: {
						type: AthenaTableScalarFieldType.bigint,
					},
					v: {
						type: AthenaTableStructFieldType.struct,
						fields: {
							rsrp: {
								type: AthenaTableScalarFieldType.int,
							},
							area: {
								type: AthenaTableScalarFieldType.int,
							},
							mccmnc: {
								type: AthenaTableScalarFieldType.int,
							},
							cell: {
								type: AthenaTableScalarFieldType.int,
							},
							ip: {
								type: AthenaTableScalarFieldType.string,
							},
						},
					},
				},
			},
		},
	},
	timestamp: {
		type: AthenaTableScalarFieldType.timestamp,
	},
	deviceId: {
		type: AthenaTableScalarFieldType.string,
	},
} as const
