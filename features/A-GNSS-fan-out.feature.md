---
variants:
  - device: agnssContainerDevice1
  - device: agnssContainerDevice2
needs:
  - A-GNSS
  - Connect a tracker
  - Register a new account
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  tracker:
    agnssContainerDevice1:
      id: device-a
    agnssContainerDevice2:
      id: device-b
---

# A-GNSS Data Fan Out (The cargo container scenario)

> In this scenario hundreds, or thousands of devices are unloaded from a steel
> walled cargo container (intermodal container). All of them connect to the
> cellular network, and the same cell tower, and request A-GNSS data, because
> they have been offline for weeks while being shipped over the ocean.
>
> While all devices should receive A-GNSS data as per their request, we do not
> want to hammer to third-party API with thousands of requests for the same
> A-GNSS data.

## Register and connect device

Given I generate a certificate for the `<variant.device>` tracker

And I connect the `<variant.device>` tracker

## Request A-GNSS data

Given the `<variant.device>` tracker is subscribed to the topic
`${tracker.<variant.device>.id}/agnss`

When the `<variant.device>` tracker publishes this message to the topic
`${tracker.<variant.device>.id}/agnss/get`

```json
{
  "mcc": "$number{agnssMcc}",
  "mnc": "$number{agnssMnc}",
  "cell": "$number{agnssCellId}",
  "area": "$number{agnssArea}",
  "types": [1, 2, 3, 4, 6, 7, 8, 9]
}
```

Soon the `<variant.device>` tracker receives `2` raw messages on the topic
`${tracker.<variant.device>.id}/agnss` into `agnssData`

Then
`$length($filter(agnssData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0`
should equal true

And
`$length($filter(agnssData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0`
should equal true
