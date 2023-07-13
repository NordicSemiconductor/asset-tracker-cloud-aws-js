---
run: never
needs:
  - Store WiFi site surveys
---

# nRF Cloud WiFi Site Survey Geolocation

> Optionally, device locations can be resolved by the nRF Cloud API using the
> WiFi site surveys

## Background

> This enqueues a mock response on the mock HTTP API the stack is configure to
> use for the nRF Cloud integration

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I have a random number between `$1` and `$2` in `accuracy`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I enqueue this mock HTTP API response with status code `200` for a `POST`
request to `api.nrfcloud.com/v1/location/ground-fix`

```json
{
  "uncertainty": "$number{accuracy}",
  "lat": "$number{lat}",
  "lon": "$number{lng}",
  "fulfilledWith": "WIFI"
}
```

## Find the latest survey

When I execute `query` of `@aws-sdk/client-dynamodb` with

```json
{
  "TableName": "${networkSurveyStorageTableName}",
  "IndexName": "surveyByDevice",
  "ScanIndexForward": false,
  "KeyConditionExpression": "#deviceId = :deviceId",
  "ExpressionAttributeNames": {
    "#deviceId": "deviceId"
  },
  "ExpressionAttributeValues": {
    ":deviceId": {
      "S": "${tracker.id}"
    }
  },
  "Limit": 1
}
```

Then I store `awsSDK.res.Items[0].surveyId.S` into `networkSurveyId`

## Retrieve the location for the survey

Given I store `$millis()` into `ts`

When I `GET ${networkSurveyGeolocationApiUrl}/${networkSurveyId}?ts=${ts}`

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
  "wifi": {
    "accessPoints": [
      { "macAddress": "4c:e1:75:80:5e:6f" },
      { "macAddress": "4c:e1:75:80:5e:6e" },
      { "macAddress": "74:3a:ef:44:b7:43" },
      { "macAddress": "74:3a:ef:44:b7:42" },
      { "macAddress": "4c:e1:75:01:15:6e" },
      { "macAddress": "4c:e1:75:01:15:6f" },
      { "macAddress": "4c:e1:75:bf:09:2e" },
      { "macAddress": "4c:e1:75:bf:09:2f" },
      { "macAddress": "74:3a:ef:44:b7:4a" },
      { "macAddress": "4c:e1:75:bf:09:21" },
      { "macAddress": "4c:e1:75:bf:09:20" },
      { "macAddress": "80:e0:1d:09:8f:67" },
      { "macAddress": "80:e0:1d:09:8f:65" },
      { "macAddress": "80:e0:1d:09:8f:61" },
      { "macAddress": "80:e0:1d:09:8f:68" },
      { "macAddress": "80:e0:1d:09:8f:62" },
      { "macAddress": "80:e0:1d:09:8f:69" },
      { "macAddress": "80:e0:1d:09:8f:6d" },
      { "macAddress": "4c:e1:75:01:15:60" },
      { "macAddress": "aa:15:44:ac:6c:3a" },
      { "macAddress": "80:e0:1d:09:8f:6a" },
      { "macAddress": "80:e0:1d:09:8f:6e" },
      { "macAddress": "9a:15:44:ac:6c:3a" },
      { "macAddress": "9e:15:44:ac:6c:3a" }
    ]
  }
}
```
