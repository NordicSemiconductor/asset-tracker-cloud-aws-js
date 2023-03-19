import type { Location } from './Location.js'

export type MaybeLocation = {
	located: boolean
} & Partial<Location>
