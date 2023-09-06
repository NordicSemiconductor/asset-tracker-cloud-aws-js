import type { LocationSource } from '../cellGeolocation/stepFunction/types.js'
import type { Location } from './Location.js'

export type MaybeLocation = (
	| {
			located: false
	  }
	| {
			located: true
			source: LocationSource
	  }
) &
	Partial<Location>
