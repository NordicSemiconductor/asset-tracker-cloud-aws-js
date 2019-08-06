import { parseAthenaResult } from './parseAthenaResult'

const ResultSet = {
	Rows: [
		{ Data: [{ VarCharValue: 'date' }, { VarCharValue: 'value' }] },
		{
			Data: [
				{ VarCharValue: '2019-08-01T10:29:54.406Z' },
				{ VarCharValue: '2607' },
			],
		},
		{
			Data: [
				{ VarCharValue: '2019-07-31T08:34:20.765Z' },
				{ VarCharValue: '2046' },
			],
		},
	],
	ResultSetMetadata: {
		ColumnInfo: [
			{
				CatalogName: 'hive',
				SchemaName: '',
				TableName: '',
				Name: 'date',
				Label: 'date',
				Type: 'varchar',
				Precision: 2147483647,
				Scale: 0,
				Nullable: 'UNKNOWN',
				CaseSensitive: true,
			},
			{
				CatalogName: 'hive',
				SchemaName: '',
				TableName: '',
				Name: 'value',
				Label: 'value',
				Type: 'integer',
				Precision: 10,
				Scale: 0,
				Nullable: 'UNKNOWN',
				CaseSensitive: false,
			},
		],
	},
}

describe('parseAthenaResult', () => {
	it('parses an Athena result into an array of values', () => {
		expect(
			parseAthenaResult({
				ResultSet,
				skip: 1,
			}),
		).toEqual([
			{
				date: '2019-08-01T10:29:54.406Z',
				value: 2607,
			},
			{
				date: '2019-07-31T08:34:20.765Z',
				value: 2046,
			},
		])
	})

	it('can accept formatters to customize row formatting', () => {
		expect(
			parseAthenaResult({
				ResultSet,
				formatters: {
					integer: v => parseInt(v, 10) / 1000,
				},
				skip: 1,
			}),
		).toEqual([
			{
				date: '2019-08-01T10:29:54.406Z',
				value: 2.607,
			},
			{
				date: '2019-07-31T08:34:20.765Z',
				value: 2.046,
			},
		])
	})

	it('can parse a DESCRIBE TABLE query', () => {
		expect(
			parseAthenaResult({
				ResultSet: {
					Rows: [
						{
							Data: [
								{
									VarCharValue:
										'reported            \tstruct<acc:struct<ts:string,v:array<float>>,bat:struct<ts:string,v:int>,gps:struct<ts:string,v:struct<acc:float,alt:float,hdg:float,lat:float,lng:float,spd:float>>>\tfrom deserializer   ',
								},
							],
						},
						{
							Data: [
								{
									VarCharValue:
										'timestamp           \ttimestamp           \tfrom deserializer   ',
								},
							],
						},
						{
							Data: [
								{
									VarCharValue:
										'deviceid            \tstring              \tfrom deserializer   ',
								},
							],
						},
					],
					ResultSetMetadata: {
						ColumnInfo: [
							{
								CatalogName: 'hive',
								SchemaName: '',
								TableName: '',
								Name: 'col_name',
								Label: 'col_name',
								Type: 'string',
								Precision: 0,
								Scale: 0,
								Nullable: 'UNKNOWN',
								CaseSensitive: false,
							},
							{
								CatalogName: 'hive',
								SchemaName: '',
								TableName: '',
								Name: 'data_type',
								Label: 'data_type',
								Type: 'string',
								Precision: 0,
								Scale: 0,
								Nullable: 'UNKNOWN',
								CaseSensitive: false,
							},
							{
								CatalogName: 'hive',
								SchemaName: '',
								TableName: '',
								Name: 'comment',
								Label: 'comment',
								Type: 'string',
								Precision: 0,
								Scale: 0,
								Nullable: 'UNKNOWN',
								CaseSensitive: false,
							},
						],
					},
				},
			}),
		).toEqual([
			{
				// eslint-disable-next-line @typescript-eslint/camelcase
				col_name: 'reported',
				comment: 'from deserializer',
				// eslint-disable-next-line @typescript-eslint/camelcase
				data_type:
					'struct<acc:struct<ts:string,v:array<float>>,bat:struct<ts:string,v:int>,gps:struct<ts:string,v:struct<acc:float,alt:float,hdg:float,lat:float,lng:float,spd:float>>>',
			},
			{
				// eslint-disable-next-line @typescript-eslint/camelcase
				col_name: 'timestamp',
				comment: 'from deserializer',
				// eslint-disable-next-line @typescript-eslint/camelcase
				data_type: 'timestamp',
			},
			{
				// eslint-disable-next-line @typescript-eslint/camelcase
				col_name: 'deviceid',
				comment: 'from deserializer',
				// eslint-disable-next-line @typescript-eslint/camelcase
				data_type: 'string',
			},
		])
	})
})
