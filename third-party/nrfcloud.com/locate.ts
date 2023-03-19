import { Type } from '@sinclair/typebox'

/**
 * @see https://api.nrfcloud.com/v1#tag/Ground-Fix/operation/GetLocationFromCellTowersOrWifiNetworks
 */
export const locateResultSchema = Type.Object({
	lat: Type.Number({ minimum: -90, maximum: 90 }),
	lon: Type.Number({ minimum: -180, maximum: 180 }),
	uncertainty: Type.Number({ minimum: 0 }),
})
