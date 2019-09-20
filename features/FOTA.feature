@Skip
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
    And I execute "createJob" of the AWS S3 SDK with
      """
      {
        "jobId": "{jobId}",
        "targets": ["{catId}"],
        "document": "{jobDocument}",
        "description": "Update {catId} to version 1.0.1.",
        "targetSelection": "SNAPSHOT"
      }
      """
    Then "jobId" of the execution result should equal "{jobId}"
