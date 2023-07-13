---
run: never
variants:
  - nw: ltem
  - nw: nbiot
---

# nRF Cloud Cell Geolocation

> Optionally, cell locations can be resolved using the nRF Cloud API

> Note: nRF Cloud's geolocation API does not distinguish between different
> network modes.

## Background

> This enqueues a mock response on the mock HTTP API the stack is configure to
> use for the nRF Cloud integration

Given I have a random number between `1` and `100000000` in `cellId`

And I have a random number between `0` and `20000` in `accuracy`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I enqueue this mock HTTP API response with status code 200 for a `POST`
request to `api.nrfcloud.com/v1/location/ground-fix`

```json
{
  "uncertainty": "$number{accuracy}",
  "lat": "$number{lat}",
  "lon": "$number{lng}",
  "fulfilledWith": "SCELL"
}
```

## Query the cell

Given I store "$millis()" into "ts"

When I
`GET ${geolocationApiUrl}/cell?cell=${cellId}&area=30401&mccmnc=24201&nw=${variant.nw}&ts=${ts}`

Then the response status code should be `200`

And the response header Access-Control-Allow-Origin should be `*`

And the response header Content-Type should be `application/json`

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
      "eci": "$number{cellId}",
      "mcc": 242,
      "mnc": 1,
      "tac": 30401
    }
  ]
}
```
