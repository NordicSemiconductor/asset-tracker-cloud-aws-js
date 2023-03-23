Feature: Store neighboring cell measurement reports

    Neighboring cell measurement reports are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB

    Contexts:

    | nw    | nw-modem |
    | ltem  | LTE-M    |
    | nbiot | NB-IoT   |

    Background:

        Given I am authenticated with Cognito
        And I am run after the "Connect a tracker" feature
        And I store a random number between 1 and 100000000 into "<nw>-ncellmeasCellId"
        And I store a random number between 1 and 100000000 into "<nw>-ncellmeasAreaId"
        And I store "{<nw>-ncellmeasCellId}" into "cellId"
        And I store "{<nw>-ncellmeasAreaId}" into "areaId"
    
    Scenario: Device connects

        Given I store "$millis()" into "ts"
        Then the tracker updates its reported state with
            """
            {
            "roam": {
                "v": {
                    "nw": "<nw-modem>",
                    "rsrp": -97,
                    "area": {cellId},
                    "mccmnc": 24201,
                    "cell": {areaId},
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
                "cell": {cellId},
                "area": {areaId},
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
                    "earfcn": 262142,
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
            "ScanIndexForward": false, 
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
        Then I store "awsSdk.res.Items[0].surveyId.S" into "<nw>-ncellmeasSurveyId"

    Scenario: Get the latest report

        When I execute "getItem" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{networkSurveyStorageTableName}",
            "Key": {
                "surveyId": {
                    "S": "{<nw>-ncellmeasSurveyId}"
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
                            "earfcn": { "N": "262142" },
                            "cell": { "N": "503" }
                        }
                        }
                    ]
                    },
                    "rsrq": { "N": "-9" },
                    "area": { "N": "{areaId}" },
                    "adv": { "N": "80" },
                    "rsrp": { "N": "-97" },
                    "mcc": { "N": "242" },
                    "mnc": { "N": "1" },
                    "earfcn": { "N": "6446" },
                    "cell": { "N": "{cellId}" },
                    "ts": { "N": "{ts}" }
                }
            },
            "nw": { "S": "<nw-modem>" },
            "deviceId": { "S": "{tracker:id}" }
        }
        """