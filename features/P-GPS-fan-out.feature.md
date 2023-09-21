---
variants:
  - device: pgpsContainerDevice1
  - device: pgpsContainerDevice2
needs:
  - P-GPS
exampleContext:
  tracker:
    pgpsContainerDevice1:
      id: device-a
    pgpsContainerDevice2:
      id: device-b
  userPassword: secret
  userEmail: user@example.com
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

## Request P-GPS data

Given the `<variant.device>` tracker is subscribed to the topic
`${tracker.<variant.device>.id}/pgps`

When the `<variant.device>` tracker publishes this message to the topic
`${tracker.<variant.device>.id}/pgps/get`

```json
{
  "n": "$number{predictionCount}",
  "time": "$number{startGpsTimeOfDaySeconds}"
}
```

Soon the `<variant.device>` tracker receives a messages on the topic
`${tracker.<variant.device>.id}/pgps` into `pgpsData`

And `pgpsData` should match

```json
{
  "path": "public/15131-0_15135-72000.bin",
  "host": "pgps.nrfcloud.com"
}
```
