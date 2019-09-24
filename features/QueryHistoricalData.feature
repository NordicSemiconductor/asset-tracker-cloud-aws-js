Feature: Query Data
  As a user
  I can query the historical data of a device

  Background:

    Given I am run after the "Read Device Shadow" feature

  Scenario: Query historical data

    Given I am authenticated with Cognito
    When I run this query in the Athena workgroup {historicaldataWorkgroupName}
       """
       SELECT reported.bat.v as value
       FROM {historicaldataDatabaseName}.{historicaldataTableName}
       WHERE deviceId='{cat:id}' AND reported.bat IS NOT NULL LIMIT 1
       """
    Then "athenaQueryResult" should match this JSON
       """
       [{"value": 3781}]
       """
