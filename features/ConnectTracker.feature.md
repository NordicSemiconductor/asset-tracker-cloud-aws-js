# Connect a tracker

> As a user I can Connect a tracker

## Generate a certificate and connect

Given I generate a certificate

## Connect the tracker

> We use just-in-time-provisioning so this scenario is expected to be retried,
> because the @aws-sdk/client-iot endpoint will disconnect a new device when it
> first connects.

> See
> https://docs.aws.amazon.com/iot/latest/developerguide/jit-provisioning.html

Given I connect the tracker
