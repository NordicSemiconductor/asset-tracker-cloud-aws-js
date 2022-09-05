Feature: Update Device Configuration
  As a user
  I can update the device configuration

  Background:

    Given I am run after the "Device: Update Shadow" feature
    And I am run after the "Attach Iot Policy to user" feature

  Scenario: Update the device configuration as a user

    Given I am authenticated with Cognito
    And I encode this payload into "payload" using JSON
       """
       {
         "state": {
           "desired": {
              "cfg": {
                "act": false,
                "actwt": 60,
                "mvres": 60,
                "mvt": 3600,
                "gnsst": 1000,
                "accath": 10.5,
                "accith": 5.2,
                "accito": 1.7
              }
            }
         }
       }
       """
    When I execute "updateThingShadow" of the AWS IotData SDK with
       """
       {
         "thingName": "{tracker:id}",
         "payload": {payload}
       }
       """
