Feature: List cats
  As a user
  I can list the cats

  Background:

    Given I am run after the "Connect a Cat Tracker" feature
    And I am authenticated with Cognito

  Scenario: The user should be able to list cats

    When I execute "listThings" of the AWS Iot SDK
    Then "things[thingName='{cat:id}'].thingName" of the execution result should equal this JSON
           """
           "{cat:id}"
           """
