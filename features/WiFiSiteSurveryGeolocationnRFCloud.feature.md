---
needs:
  - Store WiFi site surveys
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  networkSurveyGeolocationApiUrl: https://daaxyz.lambda-url.eu-west-1.on.aws
  networkSurveyId: bdfe16e9-2aec-48e3-8b1f-addd9560d3b7
  ts: 1694598183204
---

# nRF Cloud WiFi Site Survey Geolocation

> Resolve the device geolocation through the WiFi site survey using the nRF
> Cloud API

## Background

> This enqueues a mock response on the mock HTTP API the stack is configure to
> use for the nRF Cloud integration

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I have a random number between `0` and `2000` in `accuracy`

And I have a random float between `-90` and `90` in `lat`

And I have a random float between `-180` and `180` in `lng`

And I enqueue this mock HTTP API response for a POST request to
`api.nrfcloud.com/v1/location/ground-fix`

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
      "S": "${tracker.default.id}"
    }
  },
  "Limit": 1
}
```

Then I store `awsSDK.res.Items[0].surveyId.S` into `networkSurveyId`

Given I store `$millis()` into `ts`

When I GET `${networkSurveyGeolocationApiUrl}/${networkSurveyId}?ts=${ts}`

Soon the response status code should equal 200

Then the `Access-Control-Allow-Origin` response header should equal `*`

And the `Content-Type` response header should equal `application/json`

And the response body should equal

```json
{
  "accuracy": "$number{accuracy}",
  "lat": "$number{lat}",
  "lng": "$number{lng}",
  "source": "WIFI"
}
```

## The nRF Cloud API should have been called

Then the mock HTTP API should have been called with a POST request to
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
