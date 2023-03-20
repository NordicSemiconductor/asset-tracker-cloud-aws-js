import type { Location } from '../../geolocation/Location.js'

export type MaybeCellGeoLocation = {
	located: boolean
} & Partial<Location>
