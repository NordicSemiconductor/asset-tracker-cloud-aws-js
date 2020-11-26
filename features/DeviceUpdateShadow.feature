Feature: Device: Update Shadow
  Devices can update their shadow

  Background:

    Given I am run after the "Connect a Cat Tracker" feature

  Scenario: Publish device information to reported state

    Given I store "$millis()" into "updateShadowTs"
    Then the cat tracker updates its reported state with
      """
      {
        "dev": {
          "v": {
            "band": 3,
            "nw": "NB-IoT GPS",
            "iccid": "89882806660004909182",
            "modV": "mfw_nrf9160_1.0.0",
            "brdV": "thingy91_nrf9160",
            "appV": "0.14.6"
          },
          "ts": {updateShadowTs}
        },
        "bat": {
          "v": 3781,
          "ts": {updateShadowTs}
        },
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
      """
