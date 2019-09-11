Feature: Attach Iot Policy to user
    As a user
    I need to attach an IoT policy to my account
    so it can send and receive IoT messages via Websockets

    Background:

        Given I am authenticated with Cognito

    Scenario: Initially the user should not have policies

        When I execute "listPrincipalPolicies" of the AWS Iot SDK with
           """
           {
             "principal": "{cognito:IdentityId}"
           }
           """
        Then "policies" of the execution result should match this JSON
           """
            []
           """

    Scenario: Self-assign the policy

        When I execute "attachPrincipalPolicy" of the AWS Iot SDK with
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
            [{"policyName":"{userIotPolicyName}","policyArn":"{userIotPolicyArn}"}]
           """
