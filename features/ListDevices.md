---
needs:
  - Connect a tracker
---

# List devices

As a user I can list the devices

## Background

And I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

## The user should be able to list devices

When I execute `listThings` of `@aws-sdk/client-iot`

Then `awsSDK.res.things[thingName='${tracker:id}'].thingName` should equal
`${tracker:id}`
