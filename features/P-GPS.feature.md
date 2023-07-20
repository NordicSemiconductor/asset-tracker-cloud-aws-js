---
needs:
  - Connect a tracker
---

# P-GPS

> Devices can request P-GPS data to decrease their time-to-fix when using GPS

## Background

> Prepare the mock API responses.

Given I have a random number between `1` and `168` in `predictionCount`

And I have a random number between `0` and `86399` in `startGpsTimeOfDaySeconds`

And I enqueue this mock HTTP API response for a GET request to
`api.nrfcloud.com/v1/location/pgps?predictionCount=${predictionCount}&predictionIntervalMinutes=240&startGpsDay=${currentGpsDay}&startGpsTimeOfDaySeconds=${startGpsTimeOfDaySeconds}`

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```

<!-- @retry:delayExecution=2000 -->

## Request P-GPS data

When the tracker publishes this message to the topic
`${tracker.default.id}/pgps/get`

```json
{
  "n": "$number{predictionCount}",
  "time": "$number{startGpsTimeOfDaySeconds}"
}
```

<!-- @retryScenario -->

Soon the tracker receives a message on the topic `${tracker.default.id}/pgps`
into `pgpsData`

Then `pgpsData` should match

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```
