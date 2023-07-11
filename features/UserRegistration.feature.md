---
---

# Register a new account

> As a user I can register a new account

> Note: this tests only that sign up is possible (which can be disabled), once
> this works, password reset etc. can be assumed to be working because this is
> handled by AWS Cognito.

## Sign up

Given I have a random email in `userEmail`

And I have a random password in `userPassword`

When I execute signUp of the AWS CognitoIdentityServiceProvider SDK with

```json
{
  "ClientId": "${userPoolClientId}",
  "Password": "${userPassword}",
  "Username": "${userEmail}"
}
```

Then `awsSdk.res` should match

```json
{
  "UserConfirmed": false
}
```
