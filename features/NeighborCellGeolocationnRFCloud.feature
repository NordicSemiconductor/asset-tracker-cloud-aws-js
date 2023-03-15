Feature: nRF Cloud Neighbor Cell Geolocation

    Optionally, device locations can be resolved by the nRF Cloud API using the neighboring cell measurement reports
    Note: nRF Cloud's geolocation API does not distinguish between different network modes.

    Background:

        This enqueues a mock response on the mock HTTP API the stack is configure
        to use for the nRF Cloud integration

        Given I am run after the "Store neighboring cell measurement reports" feature
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
                "fulfilledWith": "MCELL"
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
        Then I store "awsSdk.res.Items[0].surveyId.S" into "networkSurveyId"
    
    Scenario: Retrieve the location for the report

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
                "lte": [
                    {
                        "mcc": 242,
                        "mnc": 1,
                        "eci": {ncellmeasCellId},
                        "tac": {ncellmeasAreaId},
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