---
variants:
  - device: cargo container device 1
  - device: cargo container device 2
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

Given I have a random UUID in `agpsDevice`

And I generate a certificate for the tracker `${agpsDevice}`

And I connect the tracker `${agpsDevice}`

## Request A-GPS data

When the tracker `${agpsDevice}` publishes this message to the topic
`${agpsDevice}/agps/get`

```json
{
  "mcc": "$number{agpsMcc}",
  "mnc": "$number{agpsMnc}",
  "cell": "$number{agpsCellId}",
  "area": "$number{agpsArea}",
  "types": [1, 2, 3, 4, 6, 7, 8, 9]
}
```

Then the tracker `${agpsDevice}` receives `2` raw messages on the topic
`${agpsDevice}/agps` into `agpsData`

And
`$length($filter(agpsData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0`
should be `true`

And
`$length($filter(agpsData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0`
should be `true`

## Delete tracker

Given I am authenticated with Cognito

When I execute `listThingPrincipals` of the AWS Iot SDK with

```json
{
  "thingName": "${agpsDevice}"
}
```

Then `$count(awsSdk.res.principals)` should equal 1

Given I store `awsSdk.res.principals[0]` into `certificateArn`

Given I store `$split(awsSdk.res.principals[0], '/')[1]` into `certificateId`

Given I execute `detachThingPrincipal` of the AWS Iot SDK with

```json
{
  "thingName": "${agpsDevice}",
  "principal": "${certificateArn}"
}
```

And I execute `updateCertificate` of the AWS Iot SDK with

```json
{
  "certificateId": "${certificateId}",
  "newStatus": "INACTIVE"
}
```

And I execute `deleteCertificate` of the AWS Iot SDK with

```json
{
  "certificateId": "${certificateId}"
}
```

And I execute `deleteThing` of the AWS Iot SDK with

```json
{
  "thingName": "${agpsDevice}"
}
```
