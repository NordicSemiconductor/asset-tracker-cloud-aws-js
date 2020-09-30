Feature: Device Firmware Upgrade over the air
  As a user
  I can upgrade the firmware of my devices
  over the air

  Background:

    Given I am run after the "Connect a Cat Tracker" feature

  Scenario: Create a new firmware upgrade as a user

    Given I am authenticated with Cognito
    And I store a UUIDv4 as "jobId"
    When I execute "putObject" of the AWS S3 SDK with
       """
        {
          "Bucket": "{fotaBucketName}",
          "Key": "{jobId}",
          "Body": "SOME HEX DATA",
          "ContentLength": 13,
          "ContentType": "text/x-hex"
	    }
       """
    When I encode this payload into "jobDocument" using JSON
      """
      {
          "operation": "app_fw_update",
          "size": 13,
          "filename": "1.0.1.hex",
          "location": {
              "protocol": "https",
              "host": "{fotaBucketName}.s3.amazonaws.com",
              "path": "{jobId}"
          },
          "fwversion": "1.0.1",
          "targetBoard": "Thingy91"
      }
      """
    And I execute "createJob" of the AWS Iot SDK with
      """
      {
        "jobId": "{jobId}",
        "targets": ["{cat:arn}"],
        "document": {jobDocument},
        "description": "Update {cat:id} to version 1.0.1.",
        "targetSelection": "SNAPSHOT"
      }
      """
    Then "awsSdk.res.jobId" should equal this JSON
      """
      "{jobId}"
      """

  Scenario: Fetch the job as a device and mark as in progress

    When the cat tracker fetches the next job into "job"
    Then "job" should match this JSON
      """
      {
        "jobId": "{jobId}",
        "status": "QUEUED"
      }
      """
    And the cat tracker marks the job in "job" as in progress

  Scenario: describe the job

    When I execute "describeJobExecution" of the AWS Iot SDK with
      """
      {
        "jobId": "{jobId}",
        "thingName": "{cat:id}"
      }
      """
    Then "awsSdk.res.execution" should match this JSON
      """
      {
        "jobId": "{jobId}",
        "status": "IN_PROGRESS",
        "versionNumber": 2
      }
      """

  Scenario: cancel the job

    When I execute "cancelJobExecution" of the AWS Iot SDK with
      """
      {
        "jobId": "{jobId}",
        "force": true,
        "thingName": "{cat:id}"
      }
      """
    When I execute "describeJobExecution" of the AWS Iot SDK with
      """
      {
        "jobId": "{jobId}",
        "thingName": "{cat:id}"
      }
      """
    Then "awsSdk.res.execution" should match this JSON
      """
      {
        "jobId": "{jobId}",
        "status": "CANCELED"
      }
      """

  Scenario: delete the job

    Given I execute "deleteObject" of the AWS S3 SDK with
       """
        {
          "Bucket": "{fotaBucketName}",
          "Key": "{jobId}"
	    }
       """
    And I execute "deleteJobExecution" of the AWS Iot SDK with
      """
      {
        "jobId": "{jobId}",
        "thingName": "{cat:id}",
        "executionNumber": 1
      }
      """
