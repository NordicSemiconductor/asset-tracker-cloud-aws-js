import { CloudFormation } from 'aws-sdk'
import { toEnv } from './toEnv'

const region = process.env.AWS_DEFAULT_REGION
const cf = new CloudFormation({ region })

const STACK_ID = process.env.STACK_ID || 'bifravst'

cf.describeStacks({ StackName: STACK_ID })
	.promise()
	.then(async ({ Stacks }) => {
		if (!Stacks || !Stacks.length || !Stacks[0].Outputs) {
			throw new Error(`Stack ${STACK_ID} not found.`)
		}
		const env = toEnv(Stacks[0].Outputs)
		process.stdout.write(env)
		process.stdout.write(`REACT_APP_AWS_REGION=${region}`)
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
