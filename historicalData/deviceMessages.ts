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
						type: AthenaTableScalarFieldType.int,
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
						type: AthenaTableScalarFieldType.int,
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
						type: AthenaTableScalarFieldType.int,
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
		},
	},
	timestamp: {
		type: AthenaTableScalarFieldType.timestamp,
	},
	deviceId: {
		type: AthenaTableScalarFieldType.string,
	},
} as const
