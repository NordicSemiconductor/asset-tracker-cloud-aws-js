---
needs:
  - Device Update Shadow
---

# Device Messages

> Devices can publish arbitrary messages on the /messages topic and that the
> messages can then be queried in Timestream.

## Background

Given I have a random number between `0` and `1024` in `button1`

And I have a random number between `0` and `1024` in `button2`

And I have a random number between `1` and `300` in `magnitude`

## Devices publishes that a button was pressed

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic
`${tracker.default.id}/messages`

```json
{
  "btn": {
    "v": "$number{button1}",
    "ts": "$number{ts}"
  }
}
```

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic
`${tracker.default.id}/messages`

```json
{
  "btn": {
    "v": "$number{button2}",
    "ts": "$number{ts}"
  }
}
```

<!-- @retry:delayExecution=2000 -->

## User retrieves the button presses

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker.default.id}' AND measure_name='btn' AND measure_value::double IS NOT NULL
ORDER BY time DESC
```

<!-- @retryScenario -->

Soon `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{button1}"
  }
]
```

<!-- @retryScenario -->

Soon `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{button2}"
  }
]
```

## Devices publishes that an impact was detected

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic
`${tracker.default.id}/messages`

```json
{
  "impact": {
    "v": "$number{magnitude}",
    "ts": "$number{ts}"
  }
}
```

<!-- @retry:delayExecution=2000 -->

## User retrieves the impact messages

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker.default.id}' AND measure_name='impact' AND measure_value::double IS NOT NULL
ORDER BY time DESC
```

<!-- @retryScenario -->

Soon `timestreamQueryResult` should match

```json
[
  {
    "value": "$number{magnitude}"
  }
]
```