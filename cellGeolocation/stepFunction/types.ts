import { Location } from '../../geolocation/Location'

export type MaybeCellGeoLocation = {
	located: boolean
} & Partial<Location>
