import { Location } from '../geolocateCell.js'

export type MaybeCellGeoLocation = {
	located: boolean
} & Partial<Location>
