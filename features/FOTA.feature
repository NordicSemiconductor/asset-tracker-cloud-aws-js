Feature: Device Firmware Upgrade over the air
  As a user
  I can upgrade the firmware of my devices
  over the air

  Background:

    Given I am run after the "Connect a Cat Tracker" feature

  Scenario: Create a new firmware upgraded as a user

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
    When I escape this JSON into "jobDocument"
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
          "targetBoard": "PCA20035"
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
    Then "jobId" of the execution result should equal this JSON
      """
      "{jobId}"
      """

  Scenario: Fetch the job as a device

    When the cat tracker fetches the next job into "job"
    Then "execution" of "job" should match this JSON
      """
      {
        "jobId": "{jobId}",
        "status": "QUEUED"
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
    Then "execution" of the execution result should match this JSON
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
