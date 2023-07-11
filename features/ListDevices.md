---
needs:
  - Connect a tracker
---

# List devices

As a user I can list the devices

## Background

And I am authenticated with Cognito

## The user should be able to list devices

When I execute `listThings` of the AWS Iot SDK

Then `awsSdk.res.things[thingName='${tracker:id}'].thingName` should equal

```
${tracker:id}
```
