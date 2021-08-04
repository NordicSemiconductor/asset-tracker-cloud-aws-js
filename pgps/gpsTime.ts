/**
 * The Global Positioning System (GPS) uses its own particular time scale GPS
 * time.
 * It differs from UTC by a nearly integer number of seconds. Both time scales
 * had identical epochs on January 5, 1980. Because GPS time is not incremented
 * by leap seconds the difference between UTC and GPS time is increasing.
 */

const offSetToUnixTime = 315874800000

/**
 * Return the microseconds since the GPS epoch
 */
export const gpsTime = (): number => Date.now() - offSetToUnixTime

/**
 * Return the days since the GPS epoch
 */
export const gpsDay = (): number => Math.floor(gpsTime() / 1000 / 60 / 24)
