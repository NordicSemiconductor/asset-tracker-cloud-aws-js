import type { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'

export type Cell = Parameters<typeof cellId>[0]
