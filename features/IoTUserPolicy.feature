Feature: Attach Iot Policy to user
    As a user
    I need to attach an IoT policy to my account
    so it can send and receive IoT messages via Websockets

    Background:

        Given I am authenticated with Cognito

    Scenario: Initially the user should not have policies

        When I execute "listAttachedPolicies" of the AWS Iot SDK with
           """
           {
             "target": "{cognito:IdentityId}"
           }
           """
        Then "awsSdk.res.policies" should match this JSON
           """
            []
           """

    Scenario: Self-assign the policy

        When I execute "attachPolicy" of the AWS Iot SDK with
           """
           {
             "target": "{cognito:IdentityId}",
             "policyName": "{userIotPolicyName}"
           }
           """
      And I execute "listAttachedPolicies" of the AWS Iot SDK with
           """
           {
             "target": "{cognito:IdentityId}"
           }
           """
      Then "awsSdk.res.policies" should match this JSON
           """
            [{"policyName":"{userIotPolicyName}"}]
           """
