---
variants:
  - device: agpsContainerDevice1
  - device: agpsContainerDevice1
needs:
  - P-GPS
---

# P-GPS Data Fan Out (The cargo container scenario)

> In this scenario hundreds, or thousands of devices are unloaded from a steel
> walled cargo container (intermodal container). All of them connect to the
> cellular network, and the same cell tower, and request P-GPS data, because
> they have been offline for weeks while being shipped over the ocean.

> While all devices should receive P-GPS data as per their request, we do not
> want to hammer to third-party API with thousands of requests for the same
> P-GPS data.

## Register and connect device

Given I generate a certificate for the `<variant.device>` tracker

And I connect the `<variant.device>` tracker

<!-- @retry:delayExecution=2000 -->

## Request P-GPS data

When the `<variant.device>` tracker publishes this message to the topic
`${tracker.<variant.device>.id}/pgps/get`

```json
{
  "n": "$number{predictionCount}",
  "time": "$number{startGpsTimeOfDaySeconds}"
}
```

<!-- @retryScenario -->

Soon the `<variant.device>` tracker receives a messages on the topic
`${tracker.<variant.device>.id}/pgps` into `pgpsData`

And `pgpsData` should match

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```

## Delete tracker

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I execute `listThingPrincipals` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "${tracker.<variant.device>.id}"
}
```

Then `$count(awsSDK.res.principals)` should equal 1

Given I store `awsSDK.res.principals[0]` into `certificateArn`

Given I store `$split(awsSDK.res.principals[0], '/')[1]` into `certificateId`

Given I execute `detachThingPrincipal` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "${tracker.<variant.device>.id}",
  "principal": "${certificateArn}"
}
```

And I execute `updateCertificate` of `@aws-sdk/client-iot` with

```json
{
  "certificateId": "${certificateId}",
  "newStatus": "INACTIVE"
}
```

And I execute `deleteCertificate` of `@aws-sdk/client-iot` with

```json
{
  "certificateId": "${certificateId}"
}
```

And I execute `deleteThing` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "${tracker.<variant.device>.id}"
}
```

And I disconnect the `<variant.device>` tracker
