# Device Firmware Upgrade over the air As a user I can upgrade the

firmware of my devices over the air

## Background

needs:

- Connect a tracker

## Create a new firmware upgrade as a user

Given I am authenticated with Cognito

Given I have a random UUID in `jobId`

When I execute "putObject" of the AWS S3 SDK with

```json
{
  "Bucket": "${fotaBucketName}",
  "Key": "${jobId}",
  "Body": "SOME HEX DATA",
  "ContentLength": 13,
  "ContentType": "text/x-hex"
}
```

When I encode this payload into "jobDocument"

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

And I execute "createJob" of the AWS Iot SDK with

```json
{
  "jobId": "${jobId}",
  "targets": ["${tracker:arn}"],
  "document": "${jobDocument}",
  "description": "Upgrade ${tracker:id} to version 1.0.1.",
  "targetSelection": "SNAPSHOT"
}
```

Then "awsSdk.res.jobId" should equal

```json
"${jobId}"
```

## Fetch the job as a device and mark as in progress

When the tracker fetches the next job into "job"

Then "job" should match

```json
{
  "jobId": "${jobId}",
  "status": "QUEUED"
}
```

And the tracker marks the job in "job" as in progress

## describe the job

When I execute "describeJobExecution" of the AWS Iot SDK with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker:id}"
}
```

Then "awsSdk.res.execution" should match

```json
{
  "jobId": "${jobId}",
  "status": "IN_PROGRESS",
  "versionNumber": 2
}
```

## cancel the job

When I execute "cancelJobExecution" of the AWS Iot SDK with

```json
{
  "jobId": "${jobId}",
  "force": true,
  "thingName": "${tracker:id}"
}
```

When I execute "describeJobExecution" of the AWS Iot SDK with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker:id}"
}
```

Then "awsSdk.res.execution" should match

```json
{
  "jobId": "${jobId}",
  "status": "CANCELED"
}
```

## delete the job

Given I execute "deleteObject" of the AWS S3 SDK with

```json
{
  "Bucket": "${fotaBucketName}",
  "Key": "${jobId}"
}
```

And I execute "deleteJobExecution" of the AWS Iot SDK with

```json
{
  "jobId": "${jobId}",
  "thingName": "${tracker:id}",
  "executionNumber": 1
}
```
