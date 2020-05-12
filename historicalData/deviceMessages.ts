import {
	Field,
	ScalarFieldType,
	StructFieldType,
} from '@bifravst/athena-helpers'

/**
 * This defines the table structure for querying device data
 */
export const deviceMessagesFields: {
	[key: string]: Field
} = {
	reported: {
		type: StructFieldType.struct,
		fields: {
			acc: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: StructFieldType.struct,
						fields: {
							x: {
								type: ScalarFieldType.float,
							},
							y: {
								type: ScalarFieldType.float,
							},
							z: {
								type: ScalarFieldType.float,
							},
						},
					},
				},
			},
			bat: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: ScalarFieldType.int,
					},
				},
			},
			gps: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: StructFieldType.struct,
						fields: {
							acc: {
								type: ScalarFieldType.float,
							},
							alt: {
								type: ScalarFieldType.float,
							},
							hdg: {
								type: ScalarFieldType.float,
							},
							lat: {
								type: ScalarFieldType.float,
							},
							lng: {
								type: ScalarFieldType.float,
							},
							spd: {
								type: ScalarFieldType.float,
							},
						},
					},
				},
			},
			dev: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: StructFieldType.struct,
						fields: {
							band: {
								type: ScalarFieldType.int,
							},
							nw: {
								type: ScalarFieldType.string,
							},
							iccid: {
								type: ScalarFieldType.string,
							},
							modV: {
								type: ScalarFieldType.string,
							},
							brdV: {
								type: ScalarFieldType.string,
							},
							appV: {
								type: ScalarFieldType.string,
							},
						},
					},
				},
			},
			roam: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: StructFieldType.struct,
						fields: {
							rsrp: {
								type: ScalarFieldType.int,
							},
							area: {
								type: ScalarFieldType.int,
							},
							mccmnc: {
								type: ScalarFieldType.int,
							},
							cell: {
								type: ScalarFieldType.int,
							},
							ip: {
								type: ScalarFieldType.string,
							},
						},
					},
				},
			},
		},
	},
	message: {
		type: StructFieldType.struct,
		fields: {
			btn: {
				type: StructFieldType.struct,
				fields: {
					ts: {
						type: ScalarFieldType.bigint,
					},
					v: {
						type: ScalarFieldType.int,
					},
				},
			},
		},
	},
	timestamp: {
		type: ScalarFieldType.timestamp,
	},
	deviceId: {
		type: ScalarFieldType.string,
	},
} as const
