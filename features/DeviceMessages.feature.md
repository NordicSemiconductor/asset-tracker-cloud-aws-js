---
needs:
  - Device Update Shadow
---

# Device Messages

> Devices can publish arbitrary messages on the /messages topic and that the
> messages can then be queried in Timestream.

## Background

Given I store a random number between `0` and `1024` into `button1`

And I store a random number between `0` and `1024` into `button2`

And I store a random number between `1` and `300` into `magnitude`

## Devices publishes that a button was pressed

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic `${tracker:id}/messages`

```json
{
  "btn": {
    "v": "$number{button1}",
    "ts": "$number{ts}"
  }
}
```

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic `${tracker:id}/messages`

```json
{
  "btn": {
    "v": "$number{button2}",
    "ts": "$number{ts}"
  }
}
```

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker:id}' AND measure_name='btn' AND measure_value::double IS NOT NULL
ORDER BY time DESC
```

Then `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{button1}"
  }
]
```

Then `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{button2}"
  }
]
```

## Devices publishes that an impact was detected

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic `${tracker:id}/messages`

```json
{
  "impact": {
    "v": "$number{magnitude}",
    "ts": "$number{ts}"
  }
}
```

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker:id}' AND measure_name='impact' AND measure_value::double IS NOT NULL
ORDER BY time DESC
```

Then `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{magnitude}"
  }
]
```
