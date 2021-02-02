import { cellFromGeolocations } from '@nordicsemiconductor/cell-geolocation-helpers'

export const fromDeviceLocations = cellFromGeolocations({
	minCellDiameterInMeters: 5000,
	percentile: 0.9,
})
