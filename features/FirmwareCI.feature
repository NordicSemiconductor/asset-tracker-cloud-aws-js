Feature: Schedule CI runs of firmware builds

    As a developer
    I can schedule runs of the firmware on real devices
    so I can continuously ensure that it works

    Note: the resources provided in this project are
    used to control the actual CI runner.
    See https://github.com/bifravst/firmware-ci

    Background:

        Given I am authenticated with AWS key "{firmwareCI:userAccessKeyId}" and secret "{firmwareCI:userSecretAccessKey}"

    Scenario: Create a device for the CI runner

        This is typically only needed once when setting up an instance
        of the firmware CI runner

        Given I create a firmware CI device as "firmwareCIDevice"

    Scenario: Create a CI job

        This happens for every firmware change

        # The job id needs to be unique, do not use the git commit hash
        Given I store a UUIDv4 as "ciJobId"

        # Create a pre-signed URL which will be used by the firmware CI
        # runner to store the log output.
        When I execute "createPresignedPost" of the AWS S3 SDK with
            """
            {
                "Bucket": "{firmwareCI:resultsBucketName}",
                "Fields": {
                    "key": "{ciJobId}.json"
                }
            }
            """
        Then I store "awsSdk.res" into "ciJobReportTarget"
        And I encode "ciJobReportTarget.fields" into "ciJobReportTargetQuery" using querystring

        # Create a blank new IoT thing (a regular cat with certificates generated locally)
        # to be used for this specific test run.
        # The firmware is then build specifically for this device.
        When I generate a certificate for the cat tracker "firmwaretest-{ciJobId}"
        Then I encode "$lookup($, 'cat:firmwaretest-{ciJobId}:clientCert')" into "firmwareTestDeviceCertificatePEM" using replaceNewLines
        And I encode "$lookup($, 'cat:firmwaretest-{ciJobId}:privateKey')" into "firmwareTestDeviceCertificatePrivateKey" using replaceNewLines
        And I encode "'{awsIotRootCA}'" into "awsIotRootCAEncoded" using replaceNewLines

        # Create a job for the AWS IoT thing used to manage the firmware CI runs
        When I encode this payload into "jobDocument" using JSON
            """
            {
                "reportUrl": "{ciJobReportTarget.url}?{ciJobReportTargetQuery}",
                "fw": "https://example.com/cat-tracker-Thingy91-ltem-debug-firmwaretest-{ciJobId}.hex",
                "target": "thingy91_nrf9160ns:ltem",
                "credentials": {
                    "secTag": 42,
                    "privateKey": "{firmwareTestDeviceCertificatePrivateKey}",
                    "clientCert": "{firmwareTestDeviceCertificatePEM}",
                    "caCert": "{awsIotRootCAEncoded}"
                }
            }
            """
        And I execute "createJob" of the AWS Iot SDK with
            """
            {
            "jobId": "{ciJobId}",
            "targets": ["{firmwareCIDevice:arn}"],
            "document": {jobDocument},
            "description": "Firmware CI job {ciJobId} for a Thingy:91 with LTE-m",
            "targetSelection": "SNAPSHOT",
            "timeoutConfig": {
            "inProgressTimeoutInMinutes": 60
            }
            }
            """
        Then "awsSdk.res.jobId" should equal this JSON
            """
            "{ciJobId}"
            """

    Scenario: Cancel Job

        When I execute "deleteJob" of the AWS Iot SDK with
            """
            {
                "jobId": "{ciJobId}",
                "force": true
            }
            """

    Scenario Outline: Delete the device for the CI runner

        Given I delete the firmware CI device "firmwareCIDevice"