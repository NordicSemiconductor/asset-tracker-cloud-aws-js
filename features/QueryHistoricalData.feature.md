---
needs:
  - Device Update Shadow
---

# Query Data

> As a user I can query the historical data of a device

## Query historical data

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I run this Timestream query

```
SELECT measure_value::double AS value
FROM "${historicaldataDatabaseName}"."${historicaldataTableName}"
WHERE deviceId='${tracker:id}' AND measure_name='bat' AND measure_value::double IS NOT NULL LIMIT 1
```

Then `timestreamQueryResult` should match

```json
[{ "value": 3781 }]
```
