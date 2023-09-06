import type { Location } from '../../geolocation/Location.js'

export enum LocationSource {
	MCELL = 'MCELL',
	SCELL = 'SCELL',
	WIFI = 'WIFI',
}

export type MaybeCellGeoLocation = (
	| {
			located: false
	  }
	| {
			located: true
			source: LocationSource
	  }
) &
	Partial<Location>
