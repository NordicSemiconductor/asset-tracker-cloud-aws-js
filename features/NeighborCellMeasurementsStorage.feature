Feature: Store neighboring cell measurement reports

    Neighboring cell measurement reports are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB

    Background:

        Given I am run after the "Device: Update Shadow" feature
        And I am authenticated with Cognito
        And I store a random number between 0 and 100000000 into "ncellmeasCellId"
        And I store a random number between 0 and 100000000 into "ncellmeasAreaId"

    Scenario: Device publishes %NCELLMEAS report

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/ncellmeas
        """
        {
            "mcc": 242,
            "mnc": 1,
            "cell": {ncellmeasCellId},
            "area": {ncellmeasAreaId},
            "earfcn": 6446,
            "adv": 80,
            "rsrp": 50,
            "rsrq": 28,
            "nmr": [
                {
                "earfcn": 262143,
                "cell": 501,
                "rsrp": 44,
                "rsrq": 25
                },
                {
                "earfcn": 262265,
                "cell": 503,
                "rsrp": 49,
                "rsrq": 20
                }
            ],
            "ts": {ts}
        }
        """

    Scenario: Find the latest report

        When I execute "query" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{ncellmeasStorageTableName}",
            "IndexName": "reportByDevice",
            "KeyConditionExpression": "#deviceId = :deviceId",
            "ExpressionAttributeNames": {
                "#deviceId": "deviceId"
            },
            "ExpressionAttributeValues": {
                ":deviceId": {
                "S": "{tracker:id}"
                }
            },
            "Limit": 1
        }
        """
        Then I store "awsSdk.res.Items[0].reportId.S" into "ncellmeasReportId"

    Scenario: Get the latest report

        When I execute "getItem" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{ncellmeasStorageTableName}",
            "Key": {
                "reportId": {
                    "S": "{ncellmeasReportId}"
                }
            }
        }
        """
        Then "awsSdk.res.Item" should match this JSON
        """
        {
            "report": {
            "M": {
                "nmr": {
                "L": [
                    {
                    "M": {
                        "rsrp": { "N": "44" },
                        "rsrq": { "N": "25" },
                        "earfcn": { "N": "262143" },
                        "cell": { "N": "501" }
                    }
                    },
                    {
                    "M": {
                        "rsrp": { "N": "49" },
                        "rsrq": { "N": "20" },
                        "earfcn": { "N": "262265" },
                        "cell": { "N": "503" }
                    }
                    }
                ]
                },
                "rsrq": { "N": "28" },
                "area": { "N": "{ncellmeasAreaId}" },
                "adv": { "N": "80" },
                "rsrp": { "N": "50" },
                "mcc": { "N": "242" },
                "mnc": { "N": "1" },
                "earfcn": { "N": "6446" },
                "cell": { "N": "{ncellmeasCellId}" },
                "ts": { "N": "{ts}" }
            }
            },
            "nw": { "S": "LTE-M GPS" },
            "deviceId": { "S": "{tracker:id}" }
        }
        """