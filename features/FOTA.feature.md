---
needs:
  - Connect a tracker
  - Register a new account
exampleContext:
  userPassword: secret
  userEmail: user@example.com
  jobId: bdfe16e9-2aec-48e3-8b1f-addd9560d3b7
---

# Device Firmware Upgrade over the air

> As a user I can upgrade the firmware of my devices over the air

## Register and connect device

Given I generate a certificate for the `fota` tracker

And I connect the `fota` tracker

## Create a new firmware upgrade as a user

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

Given I have a random UUID in `jobId`

When I execute `putObject` of `@aws-sdk/client-s3` with

```json
{
  "Bucket": "${fotaBucketName}",
  "Key": "${jobId}",
  "Body": "SOME HEX DATA",
  "ContentLength": 13,
  "ContentType": "text/x-hex"
}
```

When I have this JSON-encoded in `jobDocument`

```json
{
  "operation": "app_fw_update",
  "size": 13,
  "filename": "1.0.1.hex",
  "location": {
    "protocol": "https",
    "host": "${fotaBucketName}.s3.amazonaws.com",
    "path": "${jobId}"
  },
  "fwversion": "1.0.1"
}
```

And I execute `createJob` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "targets": ["${tracker.fota.arn}"],
  "document": "${jobDocument}",
  "description": "Upgrade ${tracker.fota.id} to version 1.0.1.",
  "targetSelection": "SNAPSHOT"
}
```

Then `awsSDK.res.jobId` should equal `${jobId}`

## Fetch the job as a device

Soon the `fota` tracker stores the next started job into `job`

Then `job` should match

```json
{
  "jobId": "${jobId}",
  "status": "IN_PROGRESS"
}
```

## describe the job

When I execute `describeJobExecution` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker.fota.id}"
}
```

Then `awsSDK.res.execution` should match

```json
{
  "jobId": "${jobId}",
  "status": "IN_PROGRESS",
  "versionNumber": 2
}
```

## cancel the job

When I execute `cancelJobExecution` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "force": true,
  "thingName": "${tracker.fota.id}"
}
```

When I execute `describeJobExecution` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker.fota.id}"
}
```

Then `awsSDK.res.execution` should match

```json
{
  "jobId": "${jobId}",
  "status": "CANCELED"
}
```

## delete the job

Given I execute `deleteObject` of `@aws-sdk/client-s3` with

```json
{
  "Bucket": "${fotaBucketName}",
  "Key": "${jobId}"
}
```

And I execute `deleteJobExecution` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker.fota.id}",
  "executionNumber": 1
}
```
