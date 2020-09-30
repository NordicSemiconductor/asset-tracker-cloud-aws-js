@Only
Feature: Execute CI runs of the firmware
    
    As a developer
    I can schedule runs of the firmware on real devices
    so I can continuously ensure that it works

    Note: the resources provided in this project are
    used to control the actual CI runner.
    See https://github.com/bifravst/device-ci

    Background:

        Given I am authenticated with AWS key "{firmwareCI:userAccessKeyId}" and secret "{firmwareCI:userSecretAccessKey}"
    
    Scenario: Create a device for the CI runner

        Given I store a UUIDv4 as "firmwareCIDeviceId"
        When I execute "createThing" of the AWS Iot SDK with
        """
        {
            "thingName": "firmware-ci-{firmwareCIDeviceId}"
        }
        """
        Then I store "awsSdk.res.thingArn" into "firmwareCIDeviceArn"
        And I execute "addThingToThingGroup" of the AWS Iot SDK with
        """
        {
            "thingName": "firmware-ci-{firmwareCIDeviceId}",
            "thingGroupName": "{firmwareCI:thingGroupName}"
        }
        """

    Scenario: Create a CI job

        Given I store a UUIDv4 as "ciJobId"
        When I escape this JSON into "jobDocument"
            """
            {
                "fw": "https://github.com/bifravst/firmware/releases/download/v3.0.0/cat-tracker-Thingy91-ltem-debug-v3.0.0.hex",
                "target": "thingy91_nrf9160ns:ltem",
                "credentials": {
                    "secTag": 42,
                    "privateKey": "<INSERT PK>",
                    "clientCert": "<INSERT CLIENT CERT>",
                    "caCert": "<INSERT CA CERT>"
                }
            }
            """
        And I execute "createJob" of the AWS Iot SDK with
            """
            {
                "jobId": "{ciJobId}",
                "targets": ["{firmwareCIDeviceArn}"],
                "document": {jobDocument},
                "description": "Run firmware v3.0.0 on Thingy:91 with LTE-m",
                "targetSelection": "SNAPSHOT"
            }
            """
        Then "awsSdk.res.jobId" should equal this JSON
            """
            "{ciJobId}"
            """

    Scenario: Fetch CI run result

        # Should be on S3