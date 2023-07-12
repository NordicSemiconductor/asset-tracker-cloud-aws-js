---
variants:
  - nw: ltem
    nw-modem: LTE-M
  - nw: nbiot
    nw-modem: NB-IoT
needs:
  - Connect a tracker
---

# Store neighboring cell measurement reports

> Neighboring cell measurement reports are too big to be stored in the AWS
> shadow, so they are stored in a DynamoDB

## Background

Given I am authenticated with Cognito

And I store a random number between `1` and `100000000` into
`${variant.nw}-ncellmeasCellId`

And I store a random number between `1` and `100000000` into
`${variant.nw}-ncellmeasAreaId`

And I store `${variant.nw}-ncellmeasCellId` into `cellId`

And I store `${variant.nw}-ncellmeasAreaId` into `areaId`

## Device connects

Given I store `$millis()` into `ts`

Then the tracker updates its reported state with

```json
{
  "roam": {
    "v": {
      "nw": "${variant.nw-modem}",
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

Then the tracker publishes this message to the topic `${tracker:id}/ground-fix`

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

## Find the latest report

When I execute `query` of the AWS DynamoDB SDK with

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
      "S": "${tracker:id}"
    }
  },
  "Limit": 1
}
```

Then I store `awsSdk.res.Items[0].surveyId.S` into
`${variant.nw}-ncellmeasSurveyId`

## Get the latest report

Given I store `${variant.nw}-ncellmeasSurveyId` into `surveyId`

When I execute `getItem` of the AWS DynamoDB SDK with

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

Then `awsSdk.res.Item` should match

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
      "area": { "N": "{areaId}" },
      "adv": { "N": "80" },
      "rsrp": { "N": "-97" },
      "mcc": { "N": "242" },
      "mnc": { "N": "1" },
      "earfcn": { "N": "6446" },
      "cell": { "N": "{cellId}" },
      "ts": { "N": "${ts}" }
    }
  },
  "nw": { "S": "${variant.nw-modem}" },
  "deviceId": { "S": "{tracker:id}" }
}
```
