Feature: Store network surveys

    Network surveys are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB.

    Background:

        Given I am run after the "Device: Update Shadow" feature
        And I am authenticated with Cognito
        And I store a random number between 1 and 100000000 into "lteNetworkCellId"
        And I store a random number between 1 and 100000000 into "lteNetworkAreaId"

    Scenario: Device publishes a networks survey that has neighboring cells and Wi-Fi APs

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/ground-fix
        """
        {
            "lte": {
                "mcc": 242,
                "mnc": 1,
                "cell": {lteNetworkCellId},
                "area": {lteNetworkAreaId},
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
            },
            "wifi": {
                "ts": {ts},
                "aps": [
                    "4ce175805e6f",
                    "4ce175805e6e",
                    "743aef44b743",
                    "743aef44b742",
                    "4ce17501156e",
                    "4ce17501156f",
                    "4ce175bf092e",
                    "4ce175bf092f",
                    "743aef44b74a",
                    "4ce175bf0921",
                    "4ce175bf0920",
                    "80e01d098f67",
                    "80e01d098f65",
                    "80e01d098f61",
                    "80e01d098f68",
                    "80e01d098f62",
                    "80e01d098f69",
                    "80e01d098f6d",
                    "4ce175011560",
                    "aa1544ac6c3a",
                    "80e01d098f6a",
                    "80e01d098f6e",
                    "9a1544ac6c3a",
                    "9e1544ac6c3a"
                ]
            }
        }
        """

    Scenario: Find the latest survey

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
        Then I store "awsSdk.res.Items[0].surveyId.S" into "networkSurveyId"

    Scenario: Get the latest survey

        When I execute "getItem" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{networkSurveyStorageTableName}",
            "Key": {
                "surveyId": {
                    "S": "{networkSurveyId}"
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
                    "area": { "N": "{lteNetworkAreaId}" },
                    "adv": { "N": "80" },
                    "rsrp": { "N": "-97" },
                    "mcc": { "N": "242" },
                    "mnc": { "N": "1" },
                    "earfcn": { "N": "6446" },
                    "cell": { "N": "{lteNetworkCellId}" },
                    "ts": { "N": "{ts}" }
                }
            },
            "nw": { "S": "LTE-M" },
            "wifi": {
                "M": {
                "ts": { "N": "{ts}" },
                "aps": {
                    "L": [
                       {"S": "4ce175805e6f"},
                       {"S": "4ce175805e6e"},
                       {"S": "743aef44b743"},
                       {"S": "743aef44b742"},
                       {"S": "4ce17501156e"},
                       {"S": "4ce17501156f"},
                       {"S": "4ce175bf092e"},
                       {"S": "4ce175bf092f"},
                       {"S": "743aef44b74a"},
                       {"S": "4ce175bf0921"},
                       {"S": "4ce175bf0920"},
                       {"S": "80e01d098f67"},
                       {"S": "80e01d098f65"},
                       {"S": "80e01d098f61"},
                       {"S": "80e01d098f68"},
                       {"S": "80e01d098f62"},
                       {"S": "80e01d098f69"},
                       {"S": "80e01d098f6d"},
                       {"S": "4ce175011560"},
                       {"S": "aa1544ac6c3a"},
                       {"S": "80e01d098f6a"},
                       {"S": "80e01d098f6e"},
                       {"S": "9a1544ac6c3a"},
                       {"S": "9e1544ac6c3a"}
                    ]
                }
                }
            },
            "deviceId": { "S": "{tracker:id}" }
        }
        """