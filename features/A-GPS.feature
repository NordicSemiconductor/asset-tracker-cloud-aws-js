@Only
Feature: A-GPS

  Devices can request A-GPS data to decrease their time-to-fix when using GPS

  Background:

    Given I am run after the "Device: Update Shadow" feature

  Scenario: Devices publishes the request

    Given the tracker publishes this message to the topic {tracker:id}/agps/get
      """
      {
        "mcc": 242,
        "mnc": 1,
        "cell": 21626624,
        "area": 30401,
        "types": [
          1,
          2,
          3,
          4,
          6,
          7,
          8,
          9
        ]
      }
      """

  Scenario: Receive A-GPS data

    The response should be split into two messages,
    because A-GPS Ephemerides data is so large it cannot
    be combined with other types

    Given the tracker receives 2 raw messages on the topic {tracker:id}/agps