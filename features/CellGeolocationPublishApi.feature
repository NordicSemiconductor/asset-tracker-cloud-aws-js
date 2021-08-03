Feature: Cell Geolocation Publish API

    Trusted clients can publish cell geolocation information,
    so it becomes available for querying.

    Background:

        Given I am run after the "Cell Geolocation API" feature
        And the endpoint is "{geolocationApiUrl}"
        And I store a random number between 1 and 100000000 into "cellId"
        And I store a random number between 10000 and 99999 into "mccmnc"
        And I store a random number between 100 and 199 into "area"
        And I store a random number between 0 and 50000 into "accuracy"
        And I store a random float between -90 and 90 into "lat"
        And I store a random float between -180 and 180 into "lng"

    Scenario: Provide cell geolocation

        When I POST to /cell with this JSON
            """
            {
            "cell": {cellId},
            "area": {area},
            "mccmnc": {mccmnc},
            "nw": "ltem",
            "lat": {lat},
            "lng": {lng},
            "accuracy": {accuracy}
            }
            """
        Then the response status code should be 202

    Scenario: Query a cell

        Given I store "$millis()" into "ts"
        When I GET /cell?cell={cellId}&area={area}&mccmnc={mccmnc}&nw=ltem&ts={ts}
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json"
        And the response should equal this JSON
            """
            {
            "lng": {lng},
            "lat": {lat},
            "accuracy": 5000
            }
            """
