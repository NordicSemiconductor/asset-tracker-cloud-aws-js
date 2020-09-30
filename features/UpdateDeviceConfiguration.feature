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
                "gpst": 1000,
                "celt": 600,
                "acct": 5
              }
            }
         }
       }
       """
    When I execute "updateThingShadow" of the AWS IotData SDK with
       """
       {
         "thingName": "{cat:id}",
         "payload": {payload}
       }
       """
