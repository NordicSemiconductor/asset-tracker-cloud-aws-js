Feature: Store WiFi site surveys

    WiFi site surveys are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB.

    Background:

        Given I am run after the "Device: Update Shadow" feature
        And I am authenticated with Cognito

    Scenario: Device publishes WiFi site survey

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/ground-fix
        """
        {
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