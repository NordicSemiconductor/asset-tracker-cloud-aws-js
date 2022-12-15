@Only
Feature: nRF Cloud WiFi Site Survey Geolocation

    Optionally, device locations can be resolved by the nRF Cloud API using the WiFi site surveys

    Background:

        This enques a mock response on the mock HTTP API the stack is configure
        to use for the nRF Cloud integration

        Given I am run after the "Store WiFi site surveys" feature
        And I am authenticated with Cognito
        And the endpoint is "{wifiSiteSurveyGeolocationApiUrl}"
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

    Scenario: Retrieve the location for the survey

        Given I store "$millis()" into "ts"
        When I GET /{wifiSiteSurveyId}?ts={ts}
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json"
        And the response should equal this JSON
            """
            {
            "accuracy": {accuracy},
            "lat": {lat},
            "lng": {lng},
            "fulfilledWith": "WIFI"
            }
            """

    Scenario: The nRF Cloud API should have been called

        Then the mock HTTP API should have been called with a POST request to api.nrfcloud.com/v1/location/ground-fix
            """
            Content-Type: application/json

            {
            "wifi": {
                "accessPoints": [
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
            }
            """