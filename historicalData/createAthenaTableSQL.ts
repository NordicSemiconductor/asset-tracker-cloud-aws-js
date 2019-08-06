export enum AthenaTableScalarFieldType {
	timestamp = 'timestamp',
	string = 'string',
	float = 'float',
	int = 'int',
}

export enum AthenaTableStructFieldType {
	struct = 'struct',
}

export enum AthenaTableArrayFieldType {
	array = 'array',
}

export type AthenaTableScalarField = {
	type: AthenaTableScalarFieldType
}

export type AthenaTableStructField = {
	type: AthenaTableStructFieldType
	fields: {
		[key: string]: AthenaTableField
	}
}

export type AthenaTableArrayField = {
	type: AthenaTableArrayFieldType
	items: AthenaTableScalarFieldType
}

export type AthenaTableField =
	| AthenaTableScalarField
	| AthenaTableStructField
	| AthenaTableArrayField

type AthenaTableFieldType =
	| AthenaTableScalarFieldType
	| AthenaTableStructFieldType
	| AthenaTableArrayFieldType

const createFieldDefinition = ({
	type,
	items,
	fields,
}: {
	type: AthenaTableFieldType
	items?: AthenaTableScalarFieldType
	fields?: {
		[key: string]: AthenaTableField
	}
}): string => {
	switch (type) {
		case AthenaTableScalarFieldType.float:
		case AthenaTableScalarFieldType.int:
		case AthenaTableScalarFieldType.timestamp:
		case AthenaTableScalarFieldType.string:
			return type
		case AthenaTableArrayFieldType.array:
			return `array<${createFieldDefinition({
				type: items as AthenaTableScalarFieldType,
			})}>`
		case AthenaTableStructFieldType.struct:
			return `struct<${Object.entries(fields as {
				[key: string]: AthenaTableField
			})
				.map(
					([field, definition]) =>
						`${field}:${createFieldDefinition(definition)}`,
				)
				.join(', ')}>`
		default:
			throw new Error(`Unknown field definition: ${type}!`)
	}
}

/**
 * Returns the SQL to create the Athena table
 * @param database Name of the Athena database
 * @param table Name of the Table
 * @param s3Location Name of the S3 bucket that contains the device messages
 * @param fields The list of fields that describe the device data
 */
export const createAthenaTableSQL = ({
	database,
	table,
	s3Location,
	fields,
}: {
	database: string
	table: string
	s3Location: string
	fields: {
		[key: string]: AthenaTableField
	}
}): string => {
	return (
		`CREATE EXTERNAL TABLE ${database}.${table} (` +
		Object.entries(fields)
			.map(([name, field]) => `\`${name}\` ${createFieldDefinition(field)}`)
			.join(', ') +
		') ' +
		"ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' " +
		'WITH SERDEPROPERTIES (' +
		"'serialization.format' = '1'" +
		`) LOCATION '${s3Location}' ` +
		"TBLPROPERTIES ('has_encrypted_data'='false');"
	)
}
