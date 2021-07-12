Feature: Read Device Shadow
  As a user
  I can read the device shadow

  Background:

    Given I am run after the "Update Device Configuration" feature

  Scenario: Read reported and desired state as user

    Given I am authenticated with Cognito
    When I execute "getThingShadow" of the AWS IotData SDK with
       """
       {"thingName": "{tracker:id}"}
       """
    And I parse "awsSdk.res.payload" into "shadow"
    Then "shadow.state.reported" should match this JSON
       """
       {
          "dev": {
            "v": {
              "iccid": "89882806660004909182",
              "modV": "mfw_nrf9160_1.0.0",
              "brdV": "thingy91_nrf9160",
              "appV": "0.14.6",
              "nw": "LTE-M GPS"
            },
            "ts": {updateShadowTs}
         },
         "roam": {
            "v": {
              "band": 3
            },
            "ts": {updateShadowTs}
         }
       }
       """
    And "shadow.state.desired" should match this JSON
       """
       {
          "cfg": {
            "act": false,
            "actwt": 60,
            "mvres": 60,
            "mvt": 3600,
            "gpst": 1000,
            "celt": 600,
            "acct": 0.5
          }
       }
       """
