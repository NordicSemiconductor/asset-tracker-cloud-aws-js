import { Type } from '@sinclair/typebox'
import { LocationSource } from '../../cellGeolocation/stepFunction/types.js'

/**
 * @see https://api.nrfcloud.com/v1#tag/Ground-Fix/operation/GetLocationFromCellsOrWifiNetworks
 */
export const locateResultSchema = Type.Object({
	lat: Type.Number({
		minimum: -90,
		maximum: 90,
		description: 'Global grid line, north to south. Vertical.',
	}),
	lon: Type.Number({
		minimum: -180,
		maximum: 180,
		description: 'Global grid line, east to west. Horizontal.',
	}),
	uncertainty: Type.Number({
		minimum: 0,
		description:
			'Radius of the uncertainty circle around the location in meters. Also known as Horizontal Positioning Error (HPE).',
	}),
	fulfilledWith: Type.Enum(LocationSource),
})
