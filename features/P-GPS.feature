Feature: P-GPS

  Devices can request P-GPS data to decrease their time-to-fix when using GPS

  Background:

    Prepare the mock API responses. 

    Given I am run after the "Connect a tracker" feature
    And I store a random number between 1 and 90 into "predictionCount"
    And I store a random number between 0 and 86399 into "startGpsTimeOfDaySeconds"
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/pgps?predictionCount={predictionCount}&predictionIntervalMinutes=240&startGpsDay={currentGpsDay}&startGpsTimeOfDaySeconds={startGpsTimeOfDaySeconds}
      """
      {
        "path": "public/15131-0_15135-72000.bin",
        "host": "pgps.nrfcloud.com"
      }
      """

  @Retry=failAfter:5,maxDelay:60000
  Scenario: Request P-GPS data

    When the tracker publishes this message to the topic {tracker:id}/pgps/get
      """
      {
        "n": {predictionCount},
        "time": {startGpsTimeOfDaySeconds}
      }
      """
    Then the tracker receives a message on the topic {tracker:id}/pgps into "pgpsData"
    And "pgpsData" should match this JSON
      """
      {
        "path": "public/15131-0_15135-72000.bin",
        "host": "pgps.nrfcloud.com"
      }
      """
