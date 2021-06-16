Feature: Schedula FOTA jobs during Firmware CI runs

    As a developer
    I can schedule FOTA jobs for firmware that runs on real devices
    so I can continuously ensure that it works

    Background:

        Given I am authenticated with AWS key "{firmwareCI:userAccessKeyId}" and secret "{firmwareCI:userSecretAccessKey}"

    Scenario: Create a CI job

        This happens for every firmware change

        # The job id needs to be unique, do not use the git commit hash
        Given I have a random UUID in "jobId"
        Given I have a random UUID in "ciDeviceId"

        # Create a blank new IoT thing (a regular tracker with certificates generated locally)
        # to be used for this specific test run.
        # The firmware is then build specifically for this device.
        When I generate a certificate for the tracker "firmwaretest-{ciDeviceId}"
        Then I encode "$lookup($, 'tracker:firmwaretest-{ciDeviceId}:clientCert')" into "firmwareTestDeviceCertificatePEM" using replaceNewLines
        And I encode "$lookup($, 'tracker:firmwaretest-{ciDeviceId}:privateKey')" into "firmwareTestDeviceCertificatePrivateKey" using replaceNewLines
        And I encode "'{awsIotRootCA}'" into "awsIotRootCAEncoded" using replaceNewLines

        # Create a job for the AWS IoT thing used to manage the firmware CI runs
        When I encode this payload into "jobDocument" using JSON
            """
            {
                "operation": "app_fw_update",
                "size": 1234,
                "filename": "asset-tracker-Thingy91-ltem-debug-firmwaretest-{ciDeviceId}.hex",
                "location": {
                    "protocol": "https",
                    "host": "example.com",
                    "path": "asset-tracker-Thingy91-ltem-debug-firmwaretest-{ciDeviceId}.hex"
                },
                "fwversion": "1.2.3",
                "target": "9160DK"
            }
            """
        And I execute "createJob" of the AWS Iot SDK with
            """
            {
            "jobId": "{jobId}",
            "targets": ["firmwaretest-{ciDeviceId}"],
            "document": {jobDocument},
            "description": "Upgrade firmwaretest-{ciDeviceId} to version 1.2.3.",
            "targetSelection": "SNAPSHOT"
            }
            """
        Then "awsSdk.res.jobId" should equal this JSON
            """
            "{jobId}"
            """

    Scenario: Cancel Job

        When I execute "deleteJob" of the AWS Iot SDK with
            """
            {
                "jobId": "{jobId}",
                "force": true
            }
            """