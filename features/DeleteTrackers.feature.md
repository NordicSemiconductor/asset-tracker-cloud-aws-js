---
run: last
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  tracker:
    default:
      id: device-a
---

# Delete trackers

> As a user I can delete trackers

## Background

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

## Delete the tracker

When I execute `listThingPrincipals` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "${tracker.default.id}"
}
```

Then `$count(awsSDK.res.principals)` should equal 1

Given I store `awsSDK.res.principals[0]` into `certificateArn`

Given I store `$split(awsSDK.res.principals[0], '/')[1]` into `certificateId`

Given I execute `detachThingPrincipal` of `@aws-sdk/client-iot` with

```json
{
  "thingName": "${tracker.default.id}",
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
  "thingName": "${tracker.default.id}"
}
```

And I disconnect the tracker
