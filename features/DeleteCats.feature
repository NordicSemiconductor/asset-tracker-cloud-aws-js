@Last
Feature: Delete cats
  As a user
  I can delete cats

  Background:

    Given I am authenticated with Cognito

  Scenario: Delete the certificate

    When I execute "listThingPrincipals" of the AWS Iot SDK with
      """
      {
        "thingName": "{cat:id}"
      }
      """
    Then "$count(awsSdk.res.principals)" should equal 1
    Given I store "awsSdk.res.principals[0]" into "certificateArn"
    Given I store "$split(awsSdk.res.principals[0], '/')[1]" into "certificateId"
    Given I execute "detachThingPrincipal" of the AWS Iot SDK with
      """
      {
        "thingName": "{cat:id}",
        "principal": "{certificateArn}"
      }
      """
    And I execute "updateCertificate" of the AWS Iot SDK with
      """
      {
        "certificateId": "{certificateId}",
        "newStatus": "INACTIVE"
      }
      """
    And I execute "deleteCertificate" of the AWS Iot SDK with
      """
      {
        "certificateId": "{certificateId}"
      }
      """
    And I execute "deleteThing" of the AWS Iot SDK with
      """
      {
        "thingName": "{cat:id}"
      }
      """
