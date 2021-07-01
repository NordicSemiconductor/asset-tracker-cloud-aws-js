Feature: Store neighboring cell measurement reports

    Neighboring cell measurement reports are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB

    Background:

        Given I am run after the "Device: Update Shadow" feature
        And I am authenticated with Cognito

    Scenario: Device publishes %NCELLMEAS report

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/ncellmeas
        """
        {
            "mcc": 242,
            "mnc": 1,
            "cid": 21679716,
            "tac": 40401,
            "earfcn": 6446,
            "timingAdvance": 80,
            "age": 16378,
            "rsrp": 50,
            "rsrq": 28,
            "nmr": [
                {
                "earfcn": 262143,
                "pci": 501,
                "timeDiff": 55,
                "rsrp": 44,
                "rsrq": 25
                },
                {
                "earfcn": 262265,
                "pci": 503,
                "timeDiff": 50,
                "rsrp": 49,
                "rsrq": 20
                }
            ],
            "ts": {ts}
        }
        """

    Scenario: Query the report

        When I execute "query" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{ncellmeasStorageTableName}",
            "KeyConditionExpression": "#deviceId = :deviceId",
            "ExpressionAttributeNames": {
                "#deviceId": "deviceId"
            },
            "ExpressionAttributeValues": {
                ":deviceId": {
                "S": "{tracker:id}"
                }
            }
        }
        """
        Then "awsSdk.res.Items" should match this JSON
        """
        [
            {
                "report": {
                    "M": {
                        "nmr": {
                            "L": [
                                {
                                    "M": {
                                        "rsrp": { "N": "44" },
                                        "timeDiff": { "N": "55" },
                                        "rsrq": { "N": "25" },
                                        "earfcn": { "N": "262143" },
                                        "pci": { "N": "501" }
                                    }
                                },
                                {
                                    "M": {
                                        "rsrp": { "N": "49" },
                                        "timeDiff": { "N": "50" },
                                        "rsrq": { "N": "20" },
                                        "earfcn": { "N": "262265" },
                                        "pci": { "N": "503" }
                                    }
                                }
                            ]
                        },
                        "mnc": { "N": "1" },
                        "rsrq": { "N": "28" },
                        "tac": { "N": "40401" },
                        "timingAdvance": { "N": "80" },
                        "rsrp": { "N": "50" },
                        "mcc": { "N": "242" },
                        "earfcn": { "N": "6446" },
                        "age": { "N": "16378" },
                        "cid": { "N": "21679716" },
                        "ts": { "N": "1625176112102" }
                    }
                },
                "deviceId": { "S": "{tracker:id}" },
                "timestamp": { "N": "{ts}" }
            }
        ]
        """