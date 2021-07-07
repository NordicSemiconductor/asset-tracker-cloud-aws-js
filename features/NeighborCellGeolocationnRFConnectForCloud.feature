@Only
Feature: nRF Connect for Cloud Neighbor Cell Geolocation

    Optionally, device locations can be resolved by the nRF Connect for Cloud API using the neighboring cell measurement reports
    Note: nRF Connect for Cloud's geolocation API does not distinguish between different network modes.

    Contexts:

    | nw    | apiNw |
    | ltem  | lte   |

    Background:

        This enques a mock response on the mock HTTP API the stack is configure
        to use for the nRF Connect for Cloud integration

        Given I am run after the "Store neighboring cell measurement reports" feature
        And I am authenticated with Cognito
        And the endpoint is "{neighborCellGeolocationApiUrl}"
        And I store "$floor($random() * 20000)" into "accuracy"
        And I store "$random() * 90" into "lat"
        And I store "$random() * 180" into "lng"
        And I enqueue this mock HTTP API response with status code 200 for a POST request to api.nrfcloud.com/v1/location/locate/nRFAssetTrackerForAWS
            """
            {
                "accuracy": {accuracy},
                "location": {
                    "lat": {lat},
                    "lng": {lng}
                }
            }
            """
            
    Scenario: Fetch the latest cell measurement report for the device

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
            },
            "Limit": 1,
            "ProjectionExpression": "reportId"
        }
        """
        Then I store "awsSdk.res.Items[0].reportId.S" into "ncellmeasReportId"
    
    Scenario: Retrieve the location for the report

        Given I store "$millis()" into "ts"
        When I GET /report/{ncellmeasReportId}/location?ts={ts}
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

    Scenario: The nRF Connect for Cloud API should have been called

        Then the mock HTTP API should have been called with a POST request to api.nrfcloud.com/v1/location/locate/nRFAssetTrackerForAWS
            """
            {
                "<apiNw>": [
                    {
                        "mcc": 242,
                        "mnc": 1,
                        "cell": {ncellmeasCellId},
                        "area": {ncellmeasAreaId},
                        "earfcn": 6446,
                        "adv": 80,
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
                        ]
                    }
                ]
            }
            """