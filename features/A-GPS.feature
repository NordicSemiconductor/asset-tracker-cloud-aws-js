Feature: A-GPS

  Devices can request A-GPS data to decrease their time-to-fix when using GPS

  Background:

    Prepare the mock API responses. The A-GPS data request will be split into
    two requests, one for type 2 (ephemerides) and one for the rest.
    FIXME: Actually using a HEAD request to determine chunk size, once it is
    implemented properly on nRF Cloud side.

    Given I am run after the "Device: Update Shadow" feature
    And I store a random number between 100 and 999 into "agpsMcc"
    And I store a random number between 0 and 99 into "agpsMnc"
    And I store a random number between 1 and 100000000 into "agpsCellId"
    And I store a random number between 100 and 199 into "agpsArea"
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=1%2C3%2C4%2C6%2C7%2C8%2C9&deviceIdentifier=nRFAssetTrackerForAWS&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream

      (binary A-GPS data) other types
      """
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=2&deviceIdentifier=nRFAssetTrackerForAWS&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream

      (binary A-GPS data) ephemerides
      """
    And I store "$millis()" into "ts"
    And the tracker updates its reported state with
            """
            {
            "dev": {
                "v": {
                    "nw": "LTE-M GPS"
                },
                "ts": {ts}
            }
            }
            """

  Scenario: Request A-GPS data

    The response should be split into two messages,
    because A-GPS Ephemerides data is so large it cannot
    be combined with other types

    When the tracker publishes this message to the topic {tracker:id}/agps/get
      """
      {
        "mcc": {agpsMcc},
        "mnc": {agpsMnc},
        "cell": {agpsCellId},
        "area": {agpsArea},
        "types": [
          1,
          2,
          3,
          4,
          6,
          7,
          8,
          9
        ]
      }
      """
    Then the tracker receives 2 raw messages on the topic {tracker:id}/agps into "agpsData"
    And  "'(binary A-GPS data) ephemerides' in agpsData" should be true
    And  "'(binary A-GPS data) other types' in agpsData" should be true