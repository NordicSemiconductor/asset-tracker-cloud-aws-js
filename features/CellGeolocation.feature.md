---
run: never
needs:
  - Connect a tracker
variants:
  - nw: ltem
    nw-modem: LTE-M
  - nw: nbiot
    nw-modem: NB-IoT
---

# Cell Geolocation API

> GNSS fixes will be stored with the cell id so that the UI can show an
> approximate tracker location based on the cell id even if a device has no
> current GNSS fix

## Device enters a cell

Given I have a random number between `$1` and `$2` in `cellId`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I store `$millis()` into `ts`

Then the tracker updates its reported state with

```json
{
  "roam": {
    "v": {
      "nw": "${variant.nw-modem}",
      "rsrp": -97,
      "area": 211,
      "mccmnc": 26201,
      "cell": "$number{cellId}",
      "ip": "10.202.80.9"
    },
    "ts": "$number{ts}"
  }
}
```

## Device acquires a GNSS fix

Given I store `$millis()+(120*1000)` into `ts`

Then the tracker updates its reported state with

```json
{
  "gnss": {
    "v": {
      "lng": "$number{lng}",
      "lat": "$number{lat}",
      "acc": 18.625809,
      "alt": 443.635193,
      "spd": 0.448984,
      "hdg": 0
    },
    "ts": "$number{ts}"
  }
}
```

## Query a cell (first time)

> The first time the API is called, the cell geolocation will not be available
> and has to be calculated, therefore the API will return 409 (Conflict)

Given I store `$millis()` into `ts`

When I
`GET ${geolocationApiUrl}/cell?cell=${cellId}&area=211&mccmnc=26201&nw=${variant.nw}&ts=${ts}`

Then the response status code should be `409`

And the `Access-Control-Allow-Origin` response header should be `*`

## Query a cell

Given I store `$millis()` into `ts`

When I
`GET /cell?cell=${cellId}&area=211&mccmnc=26201&nw=${variant.nw}&ts=${ts}`

Then the response status code should be `200`

And the `Access-Control-Allow-Origin` response header should be `*`

And the `Content-Type` response header should be `application/json`

And the response should equal

```json
{
  "lng": "$number{lng}",
  "lat": "$number{lat}",
  "accuracy": 5000
}
```
