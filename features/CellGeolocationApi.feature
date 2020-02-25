Feature: Cell Geolocation API

    The cell geolocations are exposed through a HTTP API
    so they can be queried by e.g. a web application

    Background:

        Given I am run after the "Cell Geolocation" feature
        And the endpoint is "{geolocationApiUrl}"

    Scenario: Query a cell

        When I GET /geolocate?cell={cellId}&area=211&mccmnc=26201
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json"
        And the response should equal this JSON
            """
            {
            "lng": {lng},
            "lat": {lat},
            "accuracy": 19
            }
            """
