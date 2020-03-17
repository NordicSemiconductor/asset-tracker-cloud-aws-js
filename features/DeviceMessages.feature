Feature: Device: Messages

  Devices can publish arbitrary messages on a special topic

  Background:

    Given I am run after the "Device: Update Shadow" feature

  Scenario: Devices publishes that a button was pressed

    Given I store "$millis()" into "ts"
    Then the cat tracker publishes this message to the topic {cat:id}/messages
      """
      {
      "btn": {
      "v": 1,
      "ts": {ts}
      }
      }
      """
    Given I store "$millis()" into "ts"
    Then the cat tracker publishes this message to the topic {cat:id}/messages
      """
      {
      "btn": {
      "v": 0,
      "ts": {ts}
      }
      }
      """

  Scenario: Query the message data

    Given I am authenticated with Cognito
    When I run this query in the Athena workgroup {historicaldataWorkgroupName}
      """
      SELECT message.btn.v as value
      FROM {historicaldataDatabaseName}.{historicaldataTableName}
      WHERE deviceId='{cat:id}' AND message.btn IS NOT NULL LIMIT 2
      """
    Then "athenaQueryResult" should match this JSON
      """
      [
        {
          "value": 1
        },
        {
          "value": 0
        }
      ]
      """
