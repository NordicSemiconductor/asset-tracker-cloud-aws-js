---
run: never
variants:
  - nw: ltem
  - nw: nbiot
needs:
  - Store neighboring cell measurement reports
---

# nRF Cloud Neighbor Cell Geolocation

> Optionally, device locations can be resolved by the nRF Cloud API using the
> neighboring cell measurement reports

> Note: nRF Cloud's geolocation API does not distinguish between different
> network modes.

## Background

> This enqueues a mock response on the mock HTTP API the stack is configure to
> use for the nRF Cloud integration

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I have a random number between `$1` and `$2` in `accuracy`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I store `${variant.nw}-ncellmeasCellId` into `cellId`

And I store `${variant.nw}-ncellmeasAreaId` into `areaId`

And I store `${variant.nw}-ncellmeasSurveyId` into `surveyId`

And I enqueue this mock HTTP API response with status code `200` for a `POST`
request to `api.nrfcloud.com/v1/location/ground-fix`

```json
{
  "uncertainty": "$number{accuracy}",
  "lat": "$number{lat}",
  "lon": "$number{lng}",
  "fulfilledWith": "MCELL"
}
```

## Retrieve the location for the report

Given I store "$millis()" into "ts"

When I GET `${networkSurveyGeolocationApiUrl}/${surveyId}?ts=${ts}`

Then the response status code should be `200`

And the `Access-Control-Allow-Origin` response header should be `*`

And the `Content-Type` response header should be `application/json`

And the response should equal

```json
{
  "accuracy": "$number{accuracy}",
  "lat": "$number{lat}",
  "lng": "$number{lng}"
}
```

## The nRF Cloud API should have been called

Then the mock HTTP API should have been called with a `POST` request to
`api.nrfcloud.com/v1/location/ground-fix`

```json
{
  "lte": [
    {
      "mcc": 242,
      "mnc": 1,
      "eci": "$number{cellId}",
      "tac": "$number{areaId}",
      "earfcn": 6446,
      "adv": 80,
      "rsrp": -97,
      "rsrq": -9,
      "nmr": [
        {
          "earfcn": 262143,
          "pci": 501,
          "rsrp": -104,
          "rsrq": -18
        },
        {
          "earfcn": 262142,
          "pci": 503,
          "rsrp": -116,
          "rsrq": -11
        }
      ]
    }
  ]
}
```
