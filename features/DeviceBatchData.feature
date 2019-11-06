Feature: Device: Batch Data
  Devices can publish batch data

  See https://github.com/bifravst/bifravst/blob/saga/docs/firmware/Protocol.md#3-past-state

  Background:

    Given I am run after the "Device: Update Shadow" feature

  Scenario: Devices can publish batch data

    Given the cat tracker publishes this message to the topic {cat:id}/batch
      """
      {
        "gps": [
          {
            "v": {
              "lng": 8.669555,
              "lat": 50.109177,
              "acc": 28.032738,
              "alt": 204.623276,
              "spd": 0.698944,
              "hdg": 0
            },
            "ts": 1567094051000
          },
          {
            "v": {
              "lng": 10.424793,
              "lat": 63.422975,
              "acc": 12.276645,
              "alt": 137.319351,
              "spd": 6.308265,
              "hdg": 77.472923
            },
            "ts": 1567165503000
          }
        ]
      }
      """

  Scenario: Query the historical gps data

    Given I am authenticated with Cognito
    When I run this query in the Athena workgroup {historicaldataWorkgroupName}
      """
      SELECT reported.gps.v.lng as value
      FROM {historicaldataDatabaseName}.{historicaldataTableName}
      WHERE deviceId='{cat:id}' AND reported.gps IS NOT NULL LIMIT 2
      """
    Then "athenaQueryResult" should match this JSON
      # The values are string because they have not yet run through the formatter
      """
      [
        {
          "value": "8.669555"
        },
        {
          "value": "10.424793"
        }
      ]
      """
