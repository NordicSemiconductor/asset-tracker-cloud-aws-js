---
run: never
needs:
  - Device Update Shadow
  - Attach Iot Policy to user
---

# Update Device Configuration

> As a user I can update the device configuration

## Update the device configuration as a user

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

And I encode this payload into `payload`

```json
{
  "state": {
    "desired": {
      "cfg": {
        "act": false,
        "actwt": 60,
        "mvres": 60,
        "mvt": 3600,
        "loct": 1000,
        "accath": 10.5,
        "accith": 5.2,
        "accito": 1.7
      }
    }
  }
}
```

When I execute `updateThingShadow` of `@aws-sdk/client-iotData` with

```json
{
  "thingName": "${tracker.id}",
  "payload": "${payload}"
}
```
