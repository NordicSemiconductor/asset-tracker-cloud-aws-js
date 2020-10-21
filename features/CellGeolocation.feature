Feature: Cell Geolocation API

    GPS fixes will be stored with the cell id
    so that the UI can show an approximate tracker location
    based on the cell id even if a device has no current GPS fix

    Background:

        Given I am run after the "Connect a Cat Tracker" feature
        And I am run after the "Device: Update Shadow" feature
        And the endpoint is "{geolocationApiUrl}"

    Scenario: Device enters a cell

        Given I store "$floor($random() * 100000000)" into "cellId"
        And I store "$random() * 90" into "lat"
        And I store "$random() * 180" into "lng"
        Then the cat tracker updates its reported state with
            """
            {
            "roam": {
            "v": {
            "rsrp": 0,
            "area": 211,
            "mccmnc": 26201,
            "cell": {cellId},
            "ip": "10.202.80.9"
            },
            "ts": 1572340324000
            }
            }
            """

    Scenario: Device acquires a GPS fix

        Given the cat tracker updates its reported state with
            """
            {
            "gps": {
            "v": {
            "lng": {lng},
            "lat": {lat},
            "acc": 18.625809,
            "alt": 443.635193,
            "spd": 0.448984,
            "hdg": 0
            },
            "ts": 1572340608948
            }
            }
            """

    Scenario: Query a cell: first time

        The first time the API is called, the cell geolocation will not be
        available and has to be calculated, therefore the API will return 409 (Conflict)

        Given I store "$millis()" into "ts"
        When I GET /cellgeolocation?cell={cellId}&area=211&mccmnc=26201&ts={ts}
        Then the response status code should be 409
        And the response Access-Control-Allow-Origin should be "*"

    Scenario: Query a cell

        Given I store "$millis()" into "ts"
        When I GET /cellgeolocation?cell={cellId}&area=211&mccmnc=26201&ts={ts}
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
