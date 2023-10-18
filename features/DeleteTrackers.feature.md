---
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  tracker:
    <variant.device>:
      id: device-a
needs:
  - Connect a tracker
order: last
variants:
  - device: default
  - device: agnssContainerDevice1
  - device: agnssContainerDevice2
  - device: pgpsContainerDevice1
  - device: pgpsContainerDevice2
  - device: fota
---

# Delete trackers

> As a user I can delete trackers

## Background

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I disconnect the tracker

## Delete the tracker

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
