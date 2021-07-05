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
            "mccmnc": 24201,
            "cell": 21679716,
            "area": 40401,
            "earfcn": 6446,
            "timingAdvance": 80,
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
                        "area": { "N": "40401" },
                        "timingAdvance": { "N": "80" },
                        "rsrp": { "N": "50" },
                        "mccmnc": { "N": "24201" },
                        "earfcn": { "N": "6446" },
                        "cell": { "N": "21679716" },
                        "ts": { "N": "{ts}" }
                    }
                },
                "deviceId": { "S": "{tracker:id}" }
            }
        ]
        """