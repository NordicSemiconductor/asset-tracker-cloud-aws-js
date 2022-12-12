Feature: Device: Messages

  Devices can publish arbitrary messages on the /messages topic and that
  the messages can then be queried in Timestream.

  Background:

    Given I am run after the "Device: Update Shadow" feature
    And I store a random number between 0 and 1024 into "button1"
    And I store a random number between 0 and 1024 into "button2"
    And I store a random number between 1 and 300 into "magnitude"

  Scenario: Devices publishes that a button was pressed

    Given I store "$millis()" into "ts"
    Then the tracker publishes this message to the topic {tracker:id}/messages
      """
      {
      "btn": {
      "v": {button1},
      "ts": {ts}
      }
      }
      """
    Given I store "$millis()" into "ts"
    Then the tracker publishes this message to the topic {tracker:id}/messages
      """
      {
      "btn": {
      "v": {button2},
      "ts": {ts}
      }
      }
      """
    Given I am authenticated with Cognito
    When I run this Timestream query
      """
      SELECT measure_value::double AS value
      FROM "{historicaldataDatabaseName}"."{historicaldataTableName}"
      WHERE deviceId='{tracker:id}' AND measure_name='btn' AND measure_value::double IS NOT NULL
      ORDER BY time DESC
      """
    Then "timestreamQueryResult" should match this JSON
      """
      [
        {
          "value": {button1}
        }
      ]
      """
    Then "timestreamQueryResult" should match this JSON
      """
      [
        {
          "value": {button2}
        }
      ]
      """

  Scenario: Devices publishes that an impact was detected

    Given I store "$millis()" into "ts"
    Then the tracker publishes this message to the topic {tracker:id}/messages
      """
      {
      "impact": {
      "v": {magnitude},
      "ts": {ts}
      }
      }
      """
    Given I am authenticated with Cognito
    When I run this Timestream query
      """
      SELECT measure_value::double AS value
      FROM "{historicaldataDatabaseName}"."{historicaldataTableName}"
      WHERE deviceId='{tracker:id}' AND measure_name='impact' AND measure_value::double IS NOT NULL
      ORDER BY time DESC
      """
    Then "timestreamQueryResult" should match this JSON
      """
      [
        {
          "value": {magnitude}
        }
      ]
      """