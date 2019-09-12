Feature: Delete cats
  As a user
  I can delete cats

  Background:

    Given I am run after the "List cats" feature
    And I am authenticated with Cognito

  Scenario: Delete the certificate

    When I execute "listThingPrincipals" of the AWS Iot SDK with
      """
      {"thingName": "{cat:id}"}
      """
    Then "$count(principals)" of the execution result should equal 1
    Given I store "principals[0]" of the execution result as "certificateArn"
    Given I store "$split(principals[0], '/')[1]" of the execution result as "certificateId"
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
      {"thingName": "{cat:id}"}
      """
