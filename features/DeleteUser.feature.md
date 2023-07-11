---
needs:
  - Attach Iot Policy to user
run: last
---

# Delete a user

> As a user I can delete my account again

## un-assign the IoT policy

When I execute `detachPolicy` of the AWS Iot SDK with

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

Then `awsSdk.res.policies` should equal

```json
[]
```

<!--
## Delete the Cognito User

TODO: We need the real cognito auth here, to get the access token

When I execute `deleteUser` of the AWS CognitoIdentityServiceProvider SDK with

```json
{
  "AccessToken": "..."
}
```

Then `awsSdk.result` should equal

```json
{}
```
-->
