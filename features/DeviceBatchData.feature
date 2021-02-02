Feature: Device: Batch Data
  Devices can publish batch data

  See https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/saga/docs/firmware/Protocol.md#3-past-state

  Background:

    Given I am run after the "Device: Update Shadow" feature
      Given I store "$millis()" into "ts1"
    And I store "$millis()+(120*1000)" into "ts2"
    And I store "$random() * 180" into "lng1"
    And I store "$random() * 180" into "lng2"

  Scenario: Devices can publish batch data

    Given the cat tracker publishes this message to the topic {cat:id}/batch
      """
      {
        "gps": [
          {
            "v": {
              "lng": {lng1},
              "lat": 50.109177,
              "acc": 28.032738,
              "alt": 204.623276,
              "spd": 0.698944,
              "hdg": 0
            },
            "ts": {ts1}
          },
          {
            "v": {
              "lng": {lng2},
              "lat": 63.422975,
              "acc": 12.276645,
              "alt": 137.319351,
              "spd": 6.308265,
              "hdg": 77.472923
            },
            "ts": {ts2}
          }
        ]
      }
      """
    And I am authenticated with Cognito
    When I run this Timestream query
      """
      SELECT measure_value::double AS value
      FROM "{historicaldataDatabaseName}"."{historicaldataTableName}"
      WHERE deviceId='{cat:id}'
      AND measure_name='gps.lng'
      AND measure_value::double IS NOT NULL
      ORDER BY time DESC
      """
    Then "timestreamQueryResult" should match this JSON
      """
      [
        {
          "value": {lng1}
        }
      ]
      """
    And "timestreamQueryResult" should match this JSON
      """
      [
        {
          "value": {lng2}
        }
      ]
      """
