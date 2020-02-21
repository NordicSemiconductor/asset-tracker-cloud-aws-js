import { Cell, Location } from '../geolocateCell'

export type CellGeo = {
	located: boolean
} & Partial<Location>

export type StateDocument = {
	deviceId: string
	roaming: Cell
}
