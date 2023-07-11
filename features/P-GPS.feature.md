---
needs:
  - Connect a tracker
---

# P-GPS

> Devices can request P-GPS data to decrease their time-to-fix when using GPS

## Background

> Prepare the mock API responses.

Given I store a random number between `1` and `168` into `predictionCount`

And I store a random number between `0` and `86399` into
`startGpsTimeOfDaySeconds`

And I enqueue this mock HTTP API response with status code `200` for a `GET`
request to
`api.nrfcloud.com/v1/location/pgps?predictionCount=${predictionCount}&predictionIntervalMinutes=240&startGpsDay=${currentGpsDay}&startGpsTimeOfDaySeconds=${startGpsTimeOfDaySeconds}`

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```

## Request P-GPS data

When the tracker publishes this message to the topic `${tracker:id}/pgps/get`

```json
{
  "n": "$number{predictionCount}",
  "time": "$number{startGpsTimeOfDaySeconds}"
}
```

<!-- This @retry:tries=5,initialDelay=2,delayFactor=2 -->

Soon the tracker receives a message on the topic `${tracker:id}/pgps` into
`pgpsData`

And `pgpsData` should match

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```
