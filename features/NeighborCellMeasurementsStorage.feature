Feature: Store neighboring cell measurement reports

    Neighboring cell measurement reports are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB

    Background:

        Given I am authenticated with Cognito
        And I store a random number between 1 and 100000000 into "ncellmeasCellId"
        And I store a random number between 1 and 100000000 into "ncellmeasAreaId"
    
    Scenario: Device connects

        Given I store "$millis()" into "ts"
        Then the tracker updates its reported state with
            """
            {
            "roam": {
                "v": {
                    "nw": "LTE-M",
                    "rsrp": -97,
                    "area": {ncellmeasAreaId},
                    "mccmnc": 24201,
                    "cell": {ncellmeasCellId},
                    "ip": "10.202.80.9"
                },
                "ts": {ts}
                }
            }
            """

    Scenario: Device publishes %NCELLMEAS report

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/ground-fix
        """
        {
            "lte": {
                "mcc": 242,
                "mnc": 1,
                "cell": {ncellmeasCellId},
                "area": {ncellmeasAreaId},
                "earfcn": 6446,
                "adv": 80,
                "rsrp": -97,
                "rsrq": -9,
                "nmr": [
                    {
                    "earfcn": 262143,
                    "cell": 501,
                    "rsrp": -104,
                    "rsrq": -18
                    },
                    {
                    "earfcn": 262265,
                    "cell": 503,
                    "rsrp": -116,
                    "rsrq": -11
                    }
                ],
                "ts": {ts}
            }
        }
        """

    Scenario: Find the latest report

        When I execute "query" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{networkSurveyStorageTableName}",
            "IndexName": "surveyByDevice",
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
        Then I store "awsSdk.res.Items[0].surveyId.S" into "ncellmeasSurveyId"

    Scenario: Get the latest report

        When I execute "getItem" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{networkSurveyStorageTableName}",
            "Key": {
                "surveyId": {
                    "S": "{ncellmeasSurveyId}"
                }
            }
        }
        """
        Then "awsSdk.res.Item" should match this JSON
        """
        {
            "lte": {
                "M": {
                    "nmr": {
                    "L": [
                        {
                        "M": {
                            "rsrp": { "N": "-104" },
                            "rsrq": { "N": "-18" },
                            "earfcn": { "N": "262143" },
                            "cell": { "N": "501" }
                        }
                        },
                        {
                        "M": {
                            "rsrp": { "N": "-116" },
                            "rsrq": { "N": "-11" },
                            "earfcn": { "N": "262265" },
                            "cell": { "N": "503" }
                        }
                        }
                    ]
                    },
                    "rsrq": { "N": "-9" },
                    "area": { "N": "{ncellmeasAreaId}" },
                    "adv": { "N": "80" },
                    "rsrp": { "N": "-97" },
                    "mcc": { "N": "242" },
                    "mnc": { "N": "1" },
                    "earfcn": { "N": "6446" },
                    "cell": { "N": "{ncellmeasCellId}" },
                    "ts": { "N": "{ts}" }
                }
            },
            "nw": { "S": "LTE-M" },
            "deviceId": { "S": "{tracker:id}" }
        }
        """