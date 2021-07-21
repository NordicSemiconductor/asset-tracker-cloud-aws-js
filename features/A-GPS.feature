@Only
Feature: A-GPS

  Devices can request A-GPS data to decrease their time-to-fix when using GPS

  Background:

    Given I am run after the "Device: Update Shadow" feature
    And I store "$floor($random() * 1000)" into "mcc"
    And I store "$floor($random() * 100)" into "mnc"
    And I store "$floor($random() * 100000000)" into "cellId"
    And I store "$floor($random() * 100) + 100" into "area"
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=1%2C3%2C4%2C6%2C7%2C8%2C9&deviceIdentifier=nRFAssetTrackerForAWS&eci={cellId}&mcc={mnc}&mnc={mcc}&requestType=custom&tac={area}
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=2&deviceIdentifier=nRFAssetTrackerForAWS&eci={cellId}&mcc={mnc}&mnc={mcc}&requestType=custom&tac={area}

  Scenario: Request A-GPS data

    The response should be split into two messages,
    because A-GPS Ephemerides data is so large it cannot
    be combined with other types

    When the tracker publishes this message to the topic {tracker:id}/agps/get
      """
      {
        "mcc": {mcc},
        "mnc": {mnc},
        "cell": {cellId},
        "area": {area},
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
    Then the tracker receives 2 raw messages on the topic {tracker:id}/agps