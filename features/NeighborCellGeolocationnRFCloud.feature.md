---
variants:
  - nw: ltem
  - nw: nbiot
needs:
  - Store neighboring cell measurement reports
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  networkSurveyGeolocationApiUrl: https://daaxyz.lambda-url.eu-west-1.on.aws
  surveyId: bdfe16e9-2aec-48e3-8b1f-addd9560d3b7
  ts: 1694598183204
---

# nRF Cloud Neighbor Cell Geolocation

> Resolve the device geolocation through the neighboring cell measurement
> reports using the nRF Cloud API.

> Note: nRF Cloud's geolocation API does not distinguish between different
> network modes.

## Background

> This enqueues a mock response on the mock HTTP API the stack is configure to
> use for the nRF Cloud integration

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I have a random number between `0` and `2000` in `accuracy`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I store `<variant.nw>_ncellmeasCellId` into `cellId`

And I store `<variant.nw>_ncellmeasAreaId` into `areaId`

And I store `<variant.nw>_ncellmeasSurveyId` into `surveyId`

And I enqueue this mock HTTP API response for a POST request to
`api.nrfcloud.com/v1/location/ground-fix`

```json
{
  "uncertainty": "$number{accuracy}",
  "lat": "$number{lat}",
  "lon": "$number{lng}",
  "fulfilledWith": "MCELL"
}
```

## Retrieve the location for the report

Given I store `$millis()` into `ts`

When I GET `${networkSurveyGeolocationApiUrl}/${surveyId}?ts=${ts}`

Soon the response status code should equal 200

Then the `Access-Control-Allow-Origin` response header should equal `*`

And the `Content-Type` response header should equal `application/json`

And the response body should equal

```json
{
  "accuracy": "$number{accuracy}",
  "lat": "$number{lat}",
  "lng": "$number{lng}",
  "source": "MCELL"
}
```

## The nRF Cloud API should have been called

Then the mock HTTP API should have been called with a POST request to
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
