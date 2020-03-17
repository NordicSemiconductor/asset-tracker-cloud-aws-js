import { Location } from '../geolocateCell'

export type MaybeCellGeoLocation = {
	located: boolean
} & Partial<Location>
