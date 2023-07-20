# Attach Iot Policy to user

> As a user I need to attach an IoT policy to my account so it can send and
> receive IoT messages via Websockets

## Background

Given I am authenticated with Cognito as `${userEmail}` with password
`${userPassword}`

## Initially the user should not have policies

When I execute `listAttachedPolicies` of `@aws-sdk/client-iot` with

```json
{
  "target": "${cognito.IdentityId}"
}
```

Then `awsSDK.res.policies` should match

```json
[]
```

## Self-assign the policy

When I execute `attachPolicy` of `@aws-sdk/client-iot` with

```json
{
  "target": "${cognito.IdentityId}",
  "policyName": "${userIotPolicyName}"
}
```

And I execute `listAttachedPolicies` of `@aws-sdk/client-iot` with

```json
{
  "target": "${cognito.IdentityId}"
}
```

Then `awsSDK.res.policies` should match

```json
[{ "policyName": "${userIotPolicyName}" }]
```
