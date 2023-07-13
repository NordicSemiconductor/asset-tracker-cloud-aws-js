import { type StepRunner } from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchStep, matchString } from './util.js'
import {
	CognitoIdentityClient,
	GetCredentialsForIdentityCommand,
	GetOpenIdTokenForDeveloperIdentityCommand,
} from '@aws-sdk/client-cognito-identity'
import {
	AdminInitiateAuthCommand,
	CognitoIdentityProviderClient,
	AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const ci = new CognitoIdentityClient({})
const cisp = new CognitoIdentityProviderClient({})

export type UserCredentials = {
	IdToken: string
	IdentityId: string
	Token: string
	AccessKeyId: string
	SecretKey: string
	SessionToken: string
	AccessToken: string
}
const userCredentials: Record<string, UserCredentials> = {}

const steps: StepRunner<World & { cognito?: UserCredentials }>[] = [
	matchStep(
		new RegExp(
			`^I am authenticated with Cognito as ${matchString(
				'email',
			)} with password ${matchString('password')}$`,
		),
		Type.Object({
			email: Type.String(),
			password: Type.String(),
		}),
		async (
			{ email, password },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			if (userCredentials[email] === undefined) {
				await cisp.send(
					new AdminConfirmSignUpCommand({
						Username: email,
						UserPoolId: context.userPoolId,
					}),
				)

				const { AuthenticationResult } = await cisp.send(
					new AdminInitiateAuthCommand({
						AuthFlow: 'ADMIN_NO_SRP_AUTH',
						UserPoolId: context.userPoolId,
						ClientId: context.userPoolClientId,
						AuthParameters: {
							USERNAME: email,
							PASSWORD: password,
						},
					}),
				)

				const { IdentityId, Token } = await ci.send(
					new GetOpenIdTokenForDeveloperIdentityCommand({
						IdentityPoolId: context.identityPoolId,
						Logins: {
							[context.developerProviderName]: email,
						},
						TokenDuration: 3600,
					}),
				)

				const { Credentials } = await ci.send(
					new GetCredentialsForIdentityCommand({
						IdentityId: IdentityId!,
						Logins: {
							['cognito-identity.amazonaws.com']: Token!,
						},
					}),
				)

				userCredentials[email] = {
					IdToken: AuthenticationResult!.IdToken!,
					IdentityId: IdentityId!,
					Token: Token!,
					AccessKeyId: Credentials!.AccessKeyId!,
					SecretKey: Credentials!.SecretKey!,
					SessionToken: Credentials!.SessionToken!,
					AccessToken: AuthenticationResult!.AccessToken!,
				}

				progress(`IdentityId: ${userCredentials[email]?.IdentityId}`)
				progress(`Token: ${userCredentials[email]?.Token}`)
				progress(`AccessKeyId: ${userCredentials[email]?.AccessKeyId}`)
				progress(`SecretKey: ${userCredentials[email]?.SecretKey}`)
				progress(`SessionToken: ${userCredentials[email]?.SessionToken}`)
				progress(`AccessToken: ${userCredentials[email]?.AccessToken}`)
			}
			context.cognito = userCredentials[email]
			return { result: userCredentials[email]?.IdentityId }
		},
	),
]
export default steps
