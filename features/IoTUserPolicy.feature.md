# Attach Iot Policy to user

> As a user I need to attach an IoT policy to my account so it can send and
> receive IoT messages via Websockets

## Background

Given I am authenticated with Cognito

## Initially the user should not have policies

When I execute `listAttachedPolicies` of the AWS Iot SDK with

```json
{
  "target": "${cognito:IdentityId}"
}
```

Then `awsSdk.res.policies` should match

```json
[]
```

## Self-assign the policy

When I execute `attachPolicy` of the AWS Iot SDK with

```json
{
  "target": "${cognito:IdentityId}",
  "policyName": "${userIotPolicyName}"
}
```

And I execute `listAttachedPolicies` of the AWS Iot SDK with

```json
{
  "target": "${cognito:IdentityId}"
}
```

Then `awsSdk.res.policies` should match

```json
[{ "policyName": "${userIotPolicyName}" }]
```
