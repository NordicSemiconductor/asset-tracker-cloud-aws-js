---
run: never
variants:
  - device: agpsContainerDevice1
  - device: agpsContainerDevice1
needs:
  - A-GPS
---

# A-GPS Data Fan Out (The cargo container scenario)

> In this scenario hundreds, or thousands of devices are unloaded from a steel
> walled cargo container (intermodal container). All of them connect to the
> cellular network, and the same cell tower, and request A-GPS data, because
> they have been offline for weeks while being shipped over the ocean.
>
> While all devices should receive A-GPS data as per their request, we do not
> want to hammer to third-party API with thousands of requests for the same
> A-GPS data.

## Register and connect device

Given I generate a certificate for the `<variant.device>` tracker

And I connect the `<variant.device>` tracker

## Request A-GPS data

When the `<variant.device>` tracker publishes this message to the topic
`${tracker.<variant.device>.id}/agps/get`

```json
{
  "mcc": "$number{agpsMcc}",
  "mnc": "$number{agpsMnc}",
  "cell": "$number{agpsCellId}",
  "area": "$number{agpsArea}",
  "types": [1, 2, 3, 4, 6, 7, 8, 9]
}
```

Then the `<variant.device>` tracker receives `2` raw messages on the topic
`<variant.device>/agps` into `agpsData`

And
`$length($filter(agpsData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0`
should equal true

And
`$length($filter(agpsData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0`
should equal true

## Delete tracker

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

When I execute `listThingPrincipals` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "<variant.device>"
}
```

Then `$count(awsSDK.res.principals)` should equal 1

Given I store `awsSDK.res.principals[0]` into `certificateArn`

Given I store `$split(awsSDK.res.principals[0], '/')[1]` into `certificateId`

Given I execute `detachThingPrincipal` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "<variant.device>",
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
  "thingName": "<variant.device>"
}
```
