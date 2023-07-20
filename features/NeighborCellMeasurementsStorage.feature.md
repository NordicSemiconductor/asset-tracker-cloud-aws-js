---
variants:
  - nw: ltem
    nwModem: LTE-M
  - nw: nbiot
    nwModem: NB-IoT
needs:
  - Connect a tracker
  - Register a new account
---

# Store neighboring cell measurement reports

> Neighboring cell measurement reports are too big to be stored in the AWS
> shadow, so they are stored in a DynamoDB

## Background

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I have a random number between `1` and `100000000` in
`<variant.nw>_ncellmeasCellId`

And I have a random number between `1` and `100000000` in
`<variant.nw>_ncellmeasAreaId`

And I store `<variant.nw>_ncellmeasCellId` into `cellId`

And I store `<variant.nw>_ncellmeasAreaId` into `areaId`

<!-- @retry:delayExecution=2000 -->

## Device connects

Given I store `$millis()` into `ts`

<!-- @retryScenario -->

Soon the tracker updates its reported state with

```json
{
  "roam": {
    "v": {
      "nw": "${variant.nwModem}",
      "rsrp": -97,
      "area": "$number{cellId}",
      "mccmnc": 24201,
      "cell": "$number{areaId}",
      "ip": "10.202.80.9"
    },
    "ts": "$number{ts}"
  }
}
```

## Device publishes `%NCELLMEAS` report

Given I store `$millis()` into `ts`

Then the tracker publishes this message to the topic
`${tracker.default.id}/ground-fix`

```json
{
  "lte": {
    "mcc": 242,
    "mnc": 1,
    "cell": "$number{cellId}",
    "area": "$number{areaId}",
    "earfcn": 6446,
    "adv": 80,
    "rsrp": -97,
    "rsrq": -9,
    "nmr": [
      {
        "earfcn": 262143,
        "cell": 501,
        "rsrp": -104,
        "rsrq": -18
      },
      {
        "earfcn": 262142,
        "cell": 503,
        "rsrp": -116,
        "rsrq": -11
      }
    ],
    "ts": "$number{ts}"
  }
}
```

<!-- @retry:delayExecution=2000 -->

## Find the latest report

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

Then I store `awsSDK.res.Items[0].surveyId.S` into
`<variant.nw>_ncellmeasSurveyId`

Given I store `<variant.nw>_ncellmeasSurveyId` into `surveyId`

When I execute `getItem` of `@aws-sdk/client-dynamodb` with

```json
{
  "TableName": "${networkSurveyStorageTableName}",
  "Key": {
    "surveyId": {
      "S": "${surveyId}"
    }
  }
}
```

<!-- @retryScenario -->

Soon `awsSDK.res.Item` should match

```json
{
  "lte": {
    "M": {
      "nmr": {
        "L": [
          {
            "M": {
              "rsrp": { "N": "-104" },
              "rsrq": { "N": "-18" },
              "earfcn": { "N": "262143" },
              "cell": { "N": "501" }
            }
          },
          {
            "M": {
              "rsrp": { "N": "-116" },
              "rsrq": { "N": "-11" },
              "earfcn": { "N": "262142" },
              "cell": { "N": "503" }
            }
          }
        ]
      },
      "rsrq": { "N": "-9" },
      "area": { "N": "$number{areaId}" },
      "adv": { "N": "80" },
      "rsrp": { "N": "-97" },
      "mcc": { "N": "242" },
      "mnc": { "N": "1" },
      "earfcn": { "N": "6446" },
      "cell": { "N": "$number{cellId}" },
      "ts": { "N": "${ts}" }
    }
  },
  "nw": { "S": "${variant.nwModem}" },
  "deviceId": { "S": "${tracker.default.id}" }
}
```
