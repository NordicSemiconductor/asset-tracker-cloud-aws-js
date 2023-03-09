Feature: Store WiFi site surveys

    WiFi site surveys are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB.

    Background:

        Given I am run after the "Connect a tracker" feature
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
            "TableName": "{networkSurveyStorageTable}",
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
            "TableName": "{networkSurveyStorageTable}",
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
                    "SS": [
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
            },
            "deviceId": { "S": "{tracker:id}" }
        }
        """