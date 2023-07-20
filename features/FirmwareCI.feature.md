# Schedule FOTA jobs during Firmware CI runs

> As a developer I can schedule FOTA jobs for firmware that runs on real devices
> so I can continuously ensure that it works

## Background

Given I am authenticated with AWS key `${firmwareCI.userAccessKeyId}` and secret
`${firmwareCI.userSecretAccessKey}`

## Create a CI job

> This happens for every firmware change

<!-- The job id needs to be unique, do not use the git commit hash -->

Given I have a random UUID in `jobId`

<!-- Create a blank new IoT thing (a regular tracker with certificates generated locally) to be used for this specific test run.
     The firmware is then build specifically for this device. -->

When I generate a certificate for the `firmwareCiDevice` tracker

Then I encode `tracker.firmwareCiDevice.clientCert` into
`firmwareTestDeviceCertificatePEM` using replaceNewLines

And I encode `tracker.firmwareCiDevice.privateKey` into
`firmwareTestDeviceCertificatePrivateKey` using replaceNewLines

And I encode `awsIotRootCA` into `awsIotRootCAEncoded` using replaceNewLines

<!-- Tracker needs to be connected so a job can be created -->

Then I connect the `firmwareCiDevice` tracker

<!-- Create a job for the @aws-sdk/client-iot thing used to manage the firmware CI runs -->

When I have this JSON-encoded in `jobDocument`

```json
{
  "operation": "app_fw_update",
  "size": 1234,
  "filename": "asset-tracker-Thingy91-ltem-debug-${tracker.firmwareCiDevice.id}.hex",
  "location": {
    "protocol": "https",
    "host": "example.com",
    "path": "asset-tracker-Thingy91-ltem-debug-${tracker.firmwareCiDevice.id}.hex"
  },
  "fwversion": "1.2.3",
  "target": "9160DK"
}
```

And I execute `createJob` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "targets": [
    "arn:aws:iot:${region}:${accountId}:thing/${tracker.firmwareCiDevice.id}"
  ],
  "document": "${jobDocument}",
  "description": "Upgrade ${tracker.firmwareCiDevice.id} to version 1.2.3.",
  "targetSelection": "SNAPSHOT"
}
```

Then `awsSDK.res.jobId` should equal `${jobId}`

## Cancel Job

When I execute `deleteJob` of `@aws-sdk/client-iot` with

```json
{
  "jobId": "${jobId}",
  "force": true
}
```

And I disconnect the `firmwareCiDevice` tracker
