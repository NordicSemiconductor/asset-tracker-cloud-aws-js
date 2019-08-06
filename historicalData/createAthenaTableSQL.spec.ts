import {
	AthenaTableArrayFieldType,
	AthenaTableScalarFieldType,
	AthenaTableStructFieldType,
	createAthenaTableSQL,
} from './createAthenaTableSQL'

describe('Athena SQL generator', () => {
	describe('createAthenaTableSQL', () => {
		it('should create the proper SQL', () => {
			expect(
				createAthenaTableSQL({
					database: 'fooDatabase',
					table: 'barTable',
					s3Location: 's3://bazBucket/',
					fields: {
						reported: {
							type: AthenaTableStructFieldType.struct,
							fields: {
								acc: {
									type: AthenaTableStructFieldType.struct,
									fields: {
										ts: {
											type: AthenaTableScalarFieldType.string,
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
											type: AthenaTableScalarFieldType.string,
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
											type: AthenaTableScalarFieldType.string,
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
					},
				}),
			).toEqual(
				`CREATE EXTERNAL TABLE fooDatabase.barTable (` +
					'`reported` struct<acc:struct<ts:string, v:array<float>>, bat:struct<ts:string, v:int>, gps:struct<ts:string, v:struct<acc:float, alt:float, hdg:float, lat:float, lng:float, spd:float>>>, `timestamp` timestamp, `deviceId` string' +
					') ' +
					"ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' " +
					'WITH SERDEPROPERTIES (' +
					"'serialization.format' = '1'" +
					`) LOCATION 's3://bazBucket/' ` +
					"TBLPROPERTIES ('has_encrypted_data'='false');",
			)
		})
	})
})
