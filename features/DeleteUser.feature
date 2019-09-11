Feature: Delete a user
    As a user
    I can delete my account again

  Background:

    Given I am run after the "Attach Iot Policy to user" feature
    And I am authenticated with Cognito

  Scenario: un-assign the IoT policy

    When I execute "detachPrincipalPolicy" of the AWS Iot SDK with
           """
           {
             "principal": "{cognito:IdentityId}",
             "policyName": "{userIotPolicyName}"
           }
           """
    And I execute "listPrincipalPolicies" of the AWS Iot SDK with
           """
           {
             "principal": "{cognito:IdentityId}"
           }
           """
    Then "policies" of the execution result should equal this JSON
           """
            []
           """

#   Scenario: Delete the Cognito User
#     TODO: We need the real cognito auth here, to get the access token
#
#     When I execute "deleteUser" of the AWS CognitoIdentityServiceProvider SDK with
#            """
#           {
#             "AccessToken": "..."
#           }
#           """
#    Then the execution result should equal this JSON
#           """
#           {}
#           """
