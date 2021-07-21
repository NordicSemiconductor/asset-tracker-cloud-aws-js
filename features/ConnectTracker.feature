Feature: Connect a tracker
  As a user
  I can Connect a tracker

  Scenario: Generate a certificate and connect

    Given I generate a certificate

  Scenario: Connect the tracker

    We use just-in-time-provisioning so this scenarion is expected to be
    retried, because the AWS IoT endpoint will disconnect a new device when
    it first connects.
    See https://docs.aws.amazon.com/iot/latest/developerguide/jit-provisioning.html

    Given I connect the tracker
