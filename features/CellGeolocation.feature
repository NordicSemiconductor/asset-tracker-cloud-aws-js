Feature: Cell Geolocation API

    GPS fixes will be stored with the cell id
    so that the UI can show an approximate tracker location
    based on the cell id even if a device has no current GPS fix

    Contexts:

    | nw    | nw-modem   |
    | ltem  | LTE-M GPS  |
    | nbiot | NB-IoT GPS |

    Background:

        Given I am run after the "Connect a tracker" feature
        And I am run after the "Device: Update Shadow" feature
        And the endpoint is "{geolocationApiUrl}"

    Scenario: Device enters a cell

        Given I store a random number between 1 and 100000000 into "cellId"
        And I store a random float between -90 and 90 into "lat"
        And I store a random float between -180 and 180 into "lng"
        And I store "$millis()" into "ts"
        Then the tracker updates its reported state with
            """
            {
            "dev": {
                "v": {
                    "nw": "<nw-modem>"
                },
                "ts": {ts}
            },
            "roam": {
            "v": {
            "rsrp": 0,
            "area": 211,
            "mccmnc": 26201,
            "cell": {cellId},
            "ip": "10.202.80.9"
            },
            "ts": {ts}
            }
            }
            """

    Scenario: Device acquires a GPS fix

        Given I store "$millis()+(120*1000)" into "ts"
        Then the tracker updates its reported state with
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
            "ts": {ts}
            }
            }
            """

    Scenario: Query a cell: first time

        The first time the API is called, the cell geolocation will not be
        available and has to be calculated, therefore the API will return 409 (Conflict)

        Given I store "$millis()" into "ts"
        When I GET /cell?cell={cellId}&area=211&mccmnc=26201&nw=<nw>&ts={ts}
        Then the response status code should be 409
        And the response Access-Control-Allow-Origin should be "*"

    Scenario: Query a cell

        Given I store "$millis()" into "ts"
        When I GET /cell?cell={cellId}&area=211&mccmnc=26201&nw=<nw>&ts={ts}
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
