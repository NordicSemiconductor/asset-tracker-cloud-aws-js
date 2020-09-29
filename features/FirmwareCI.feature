@Only
Feature: Execute CI runs of the firmware
    
    As a developer
    I can schedule runs of the firmware on real devices
    so I can continuously ensure that it works

    Note: the resources provided in this project are
    used to control the actual CI runner.
    See https://github.com/bifravst/device-ci

    Background:

        Given I am authenticated with Cognito
        And I am member of the "firmware-ci" Cognito user group
    
    Scenario: Create a device for the CI runner

        Given I store a UUIDv4 as "firmwareCIDeviceId"
        When I execute "createThing" of the AWS Iot SDK with
        """
        {
            "thingName": "firmware-ci-{firmwareCIDeviceId}"
        }
        """
        And I execute "addThingToGroup" of the AWS Iot SDK with
        """
        {
            "thingName": "firmware-ci-{firmwareCIDeviceId}",
            "thingGroupName": "{firmwareCIDevicesThingGroupName}"
        }
        """

    Scenario: Create a CI job

        Given I store a UUIDv4 as "ciJobId"
        When I execute "createJob" of the AWS Iot SDK with
        """
        {
            "Bucket": "{fotaBucketName}",
            "Key": "{jobId}",
            "Body": "SOME HEX DATA",
            "ContentLength": 13,
            "ContentType": "text/x-hex"
        }
        """

    Scenario: Fetch CI run result

        # Should be on S3