Feature: Store WiFi site surveys

    WiFi site surveys are too big to be stored in the AWS
    shadow, so they are stored in a DynamoDB.

    Background:

        Given I am run after the "Connect a tracker" feature
        And I am authenticated with Cognito

    Scenario: Device publishes WiFi site survey

        Given I store "$millis()" into "ts"
        Then the tracker publishes this message to the topic {tracker:id}/wifiap
        """
        {
            "ts": {ts},
            "wmr": [
                {
                "mac": "80:e0:1d:09:8f:62",
                "ssid": "TnGroup",
                "rssi": -69,
                "chan": 6
                },
                {
                "mac": "80:e0:1d:09:8f:65",
                "ssid": "TnNorge",
                "rssi": -69,
                "chan": 6
                },
                {
                "mac": "80:e0:1d:30:bb:07",
                "ssid": "TnNorgeMacOS",
                "rssi": -75,
                "chan": 11
                },
                {
                "mac": "7c:10:c9:02:b8:6c",
                "ssid": "PTU_TEST_5G",
                "rssi": -85,
                "chan": 36
                },
                {
                "mac": "80:e0:1d:30:bb:0c",
                "ssid": "Telenor_Skunk_Works",
                "rssi": -82,
                "chan": 52
                },
                {
                "mac": "80:e0:1d:09:8f:6e",
                "ssid": "Telenor_Guest",
                "rssi": -80,
                "chan": 60
                },
                {
                "mac": "4c:e1:75:80:5e:6f",
                "ssid": "NORDIC-GUEST",
                "rssi": -53,
                "chan": 100
                },
                {
                "mac": "4c:e1:75:80:5e:6e",
                "ssid": "NORDIC-INTERNAL",
                "rssi": -53,
                "chan": 100
                },
                {
                "mac": "4c:e1:75:bf:09:2f",
                "ssid": "NORDIC-GUEST",
                "rssi": -57,
                "chan": 116
                },
                {
                "mac": "4c:e1:75:bf:09:2e",
                "ssid": "NORDIC-INTERNAL",
                "rssi": -58,
                "chan": 116
                }
            ]
            }
        """

    Scenario: Find the latest survey

        When I execute "query" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{wifiSiteSurveyStorageTableName}",
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
        Then I store "awsSdk.res.Items[0].surveyId.S" into "wifiSiteSurveyId"

    Scenario: Get the latest survey

        When I execute "getItem" of the AWS DynamoDB SDK with
        """
        {
            "TableName": "{wifiSiteSurveyStorageTableName}",
            "Key": {
                "surveyId": {
                    "S": "{wifiSiteSurveyId}"
                }
            }
        }
        """
        Then "awsSdk.res.Item" should match this JSON
        """
        {
            "survey": {
                "M": {
                "ts": { "N": "{ts}" },
                "wmr": {
                    "L": [
                    {
                        "M": {
                        "mac": { "S": "80:e0:1d:09:8f:62" },
                        "ssid": { "S": "TnGroup" },
                        "rssi": { "N": "-69" },
                        "chan": { "N": "6" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "80:e0:1d:09:8f:65" },
                        "ssid": { "S": "TnNorge" },
                        "rssi": { "N": "-69" },
                        "chan": { "N": "6" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "80:e0:1d:30:bb:07" },
                        "ssid": { "S": "TnNorgeMacOS" },
                        "rssi": { "N": "-75" },
                        "chan": { "N": "11" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "7c:10:c9:02:b8:6c" },
                        "ssid": { "S": "PTU_TEST_5G" },
                        "rssi": { "N": "-85" },
                        "chan": { "N": "36" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "80:e0:1d:30:bb:0c" },
                        "ssid": { "S": "Telenor_Skunk_Works" },
                        "rssi": { "N": "-82" },
                        "chan": { "N": "52" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "80:e0:1d:09:8f:6e" },
                        "ssid": { "S": "Telenor_Guest" },
                        "rssi": { "N": "-80" },
                        "chan": { "N": "60" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "4c:e1:75:80:5e:6f" },
                        "ssid": { "S": "NORDIC-GUEST" },
                        "rssi": { "N": "-53" },
                        "chan": { "N": "100" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "4c:e1:75:80:5e:6e" },
                        "ssid": { "S": "NORDIC-INTERNAL" },
                        "rssi": { "N": "-53" },
                        "chan": { "N": "100" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "4c:e1:75:bf:09:2f" },
                        "ssid": { "S": "NORDIC-GUEST" },
                        "rssi": { "N": "-57" },
                        "chan": { "N": "116" }
                        }
                    },
                    {
                        "M": {
                        "mac": { "S": "4c:e1:75:bf:09:2e" },
                        "ssid": { "S": "NORDIC-INTERNAL" },
                        "rssi": { "N": "-58" },
                        "chan": { "N": "116" }
                        }
                    }
                    ]
                }
                }
            },
            "deviceId": { "S": "{tracker:id}" }
        }
        """