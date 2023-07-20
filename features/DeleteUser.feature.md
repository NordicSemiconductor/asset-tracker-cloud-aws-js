---
needs:
  - Attach Iot Policy to user
run: last
---

# Delete a user

> As a user I can delete my account again

## un-assign the IoT policy

When I execute `detachPolicy` of `@aws-sdk/client-iot` with

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

Then `awsSDK.res.policies` should equal

```json
[]
```

## Delete the Cognito User

When I execute `deleteUser` of `@aws-sdk/client-cognito-identity-provider` with

```json
{
  "AccessToken": "${cognito.AccessToken}"
}
```
