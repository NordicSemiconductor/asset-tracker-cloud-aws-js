---
needs:
  - Device Update Shadow
exampleContext:
  userPassword: secret
  userEmail: user@example.com
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
WHERE deviceId='${tracker.default.id}' AND measure_name='bat' AND measure_value::double IS NOT NULL LIMIT 1
```

Soon the Timestream result should match

```json
[{ "value": 3781 }]
```
