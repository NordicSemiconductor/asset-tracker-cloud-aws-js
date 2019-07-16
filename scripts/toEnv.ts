import { CloudFormation } from 'aws-sdk'
import * as changeCase from 'change-case'
import * as os from 'os'

const toEnvKey = (key: string) => `REACT_APP_${changeCase.constantCase(key)}`

export const toEnv = (output: CloudFormation.Output[]) =>
	output.reduce(
		(env, { OutputKey, OutputValue }) =>
			`${env}${toEnvKey(OutputKey || '')}=${OutputValue}${os.EOL}`,
		'',
	)
