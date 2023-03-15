Feature: nRF Cloud Network Survey Geolocation

    Optionally, device locations can be resolved by the nRF Cloud API using the network site surveys

    Background:

        This enqueues a mock response on the mock HTTP API the stack is configure
        to use for the nRF Cloud integration

        Given I am run after the "Store network surveys" feature
        And I am authenticated with Cognito
        And the endpoint is "{networkSurveyGeolocationApiUrl}"
        And I store a random number between 0 and 20000 into "accuracy"
        And I store a random float between -90 and 90 into "lat"
        And I store a random float between -180 and 180 into "lng"
        And I enqueue this mock HTTP API response with status code 200 for a POST request to api.nrfcloud.com/v1/location/ground-fix
            """
            {
            "uncertainty": {accuracy},
            "lat": {lat},
            "lon": {lng},
            "fulfilledWith": "WIFI"
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

    Scenario: Retrieve the location for the survey

        Given I store "$millis()" into "ts"
        When I GET /{networkSurveyId}?ts={ts}
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json"
        And the response should equal this JSON
            """
            {
            "accuracy": {accuracy},
            "lat": {lat},
            "lng": {lng}
            }
            """

    Scenario: The nRF Cloud API should have been called

        Then the mock HTTP API should have been called with a POST request to api.nrfcloud.com/v1/location/ground-fix
            """
            Content-Type: application/json

            {
                "wifi": {
                    "accessPoints": [
                        {"macAddress": "4c:e1:75:80:5e:6f"},
                        {"macAddress": "4c:e1:75:80:5e:6e"},
                        {"macAddress": "74:3a:ef:44:b7:43"},
                        {"macAddress": "74:3a:ef:44:b7:42"},
                        {"macAddress": "4c:e1:75:01:15:6e"},
                        {"macAddress": "4c:e1:75:01:15:6f"},
                        {"macAddress": "4c:e1:75:bf:09:2e"},
                        {"macAddress": "4c:e1:75:bf:09:2f"},
                        {"macAddress": "74:3a:ef:44:b7:4a"},
                        {"macAddress": "4c:e1:75:bf:09:21"},
                        {"macAddress": "4c:e1:75:bf:09:20"},
                        {"macAddress": "80:e0:1d:09:8f:67"},
                        {"macAddress": "80:e0:1d:09:8f:65"},
                        {"macAddress": "80:e0:1d:09:8f:61"},
                        {"macAddress": "80:e0:1d:09:8f:68"},
                        {"macAddress": "80:e0:1d:09:8f:62"},
                        {"macAddress": "80:e0:1d:09:8f:69"},
                        {"macAddress": "80:e0:1d:09:8f:6d"},
                        {"macAddress": "4c:e1:75:01:15:60"},
                        {"macAddress": "aa:15:44:ac:6c:3a"},
                        {"macAddress": "80:e0:1d:09:8f:6a"},
                        {"macAddress": "80:e0:1d:09:8f:6e"},
                        {"macAddress": "9a:15:44:ac:6c:3a"},
                        {"macAddress": "9e:15:44:ac:6c:3a"}
                    ]
                },
                "lte": [
                    {
                        "mcc": 242,
                        "mnc": 1,
                        "eci": {lteNetworkCellId},
                        "tac": {lteNetworkAreaId},
                        "earfcn": 6446,
                        "adv": 80,
                        "rsrp": -97,
                        "rsrq": -9,
                        "nmr": [
                            {
                            "earfcn": 262143,
                            "pci": 501,
                            "rsrp": -104,
                            "rsrq": -18
                            },
                            {
                            "earfcn": 262142,
                            "pci": 503,
                            "rsrp": -116,
                            "rsrq": -11
                            }
                        ]
                    }
                ]
            }
            """