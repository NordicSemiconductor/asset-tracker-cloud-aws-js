import { Athena } from 'aws-sdk'

export type ParsedResult = { [key: string]: string | number }[]

const defaultFormatters = {
	integer: (v: string) => parseInt(v, 10),
	default: (v: string) => v,
} as { [key: string]: (v: string) => any }

export const parseAthenaResult = ({
	ResultSet: { Rows, ResultSetMetadata },
	formatters,
	skip,
}: {
	ResultSet: Athena.ResultSet
	formatters?: {
		integer: (v: string) => number
	}
	skip?: number
}): ParsedResult => {
	if (!Rows || !ResultSetMetadata || !ResultSetMetadata.ColumnInfo) {
		return []
	}
	const { ColumnInfo } = ResultSetMetadata
	return Rows.slice(skip).map(({ Data }) => {
		if (!Data) {
			return {}
		}
		return ColumnInfo.reduce((result, { Name, Type }, key) => {
			let v
			if (Data.length !== ColumnInfo.length && Data.length === 1) {
				// tab-separated
				v = (Data[0].VarCharValue as string).split('\t').map(t => t.trim())[key]
			} else {
				v = Data[key].VarCharValue
			}
			if (v !== undefined) {
				const formatter =
					(formatters || defaultFormatters)[Type] || defaultFormatters.default
				v = formatter(v)
			}
			return {
				...result,
				[Name]: v,
			}
		}, {})
	})
}
