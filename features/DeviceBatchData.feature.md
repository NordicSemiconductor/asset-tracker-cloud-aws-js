---
needs:
  - Device Update Shadow
---

# Device Batch Data

> Devices can publish batch data

## Background

Given I store `$millis()` into `ts1`

And I store `$millis()+(120*1000)` into `ts2`

And I store a random float between `-180` and `180` into `lng1`

And I store a random float between `-180` and `180` into `lng2`

## Devices can publish batch data

Given the tracker publishes this message to the topic `${tracker:id}/batch`

```json
{
  "gnss": [
    {
      "v": {
        "lng": "$number{lng1}",
        "lat": 50.109177,
        "acc": 28.032738,
        "alt": 204.623276,
        "spd": 0.698944,
        "hdg": 0
      },
      "ts": "$number{ts1}"
    },
    {
      "v": {
        "lng": "$number{lng2}",
        "lat": 63.422975,
        "acc": 12.276645,
        "alt": 137.319351,
        "spd": 6.308265,
        "hdg": 77.472923
      },
      "ts": "$number{ts2}"
    }
  ]
}
```

And I am authenticated with Cognito

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker:id}'

AND measure_name='gnss.lng'

AND measure_value::double IS NOT NULL

ORDER BY time DESC
```

Then "timestreamQueryResult" should match

```json
[
  {
    "value": "$number{lng1}"
  }
]
```

And "timestreamQueryResult" should match

```json
[
  {
    "value": "$number{lng2}"
  }
]
```
