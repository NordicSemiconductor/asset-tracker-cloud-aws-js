Feature: Query Data
  As a user
  I can query the historical data of a device

  Background:

    Given I am run after the "Read Device Shadow" feature

  Scenario: Query historical data

    Given I am authenticated with Cognito
    When I run this Timestream query
      """
      SELECT measure_value::double AS value
      FROM "{historicaldataDatabaseName}"."{historicaldataTableName}"
      WHERE deviceId='{cat:id}' AND measure_name='bat' AND measure_value::double IS NOT NULL LIMIT 1
      """
    Then "timestreamQueryResult" should match this JSON
       """
       [{"value": 3781}]
       """
