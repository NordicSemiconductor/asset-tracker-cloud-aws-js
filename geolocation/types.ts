import { Location } from './Location'

export type MaybeLocation = {
	located: boolean
} & Partial<Location>
