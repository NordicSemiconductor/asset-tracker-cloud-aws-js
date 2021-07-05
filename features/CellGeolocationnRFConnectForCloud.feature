Feature: nRF Connect for Cloud Cell Geolocation

    Optionally, cell locations can be resolved using the nRF Connect for Cloud API
    Note: nRF Connect for Cloud's cell geolocation API does not distinguish between different network modes.

    Contexts:

    | nw    | apiNw |
    | ltem  | lte   |

    Background:

        This enques a mock response on the mock HTTP API the stack is configure
        to use for the nRF Connect for Cloud integration

        # Given I am run after the "Cell Geolocation API" feature
        And the endpoint is "{geolocationApiUrl}"
        Given I store "$floor($random() * 100000000)" into "cellId"
        And I store "$floor($random() * 20000)" into "accuracy"
        And I store "$floor($random() * 8000)" into "alt"
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
            
    Scenario: Query the cell

        Given I store "$millis()" into "ts"
        When I GET /cell?cell={cellId}&area=30401&mccmnc=24201&nw=<nw>&ts={ts}
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
                        "tac": 30401,
                        "cid": {cellId}
                    }
                ]
            }
            """