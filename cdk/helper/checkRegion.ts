import chalk from 'chalk'
import { supportedRegions } from '../regions'

export const checkRegion = (): void => {
	if (!supportedRegions.includes(process.env.AWS_REGION ?? 'us-east-1')) {
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(
				`Your region ${
					process.env.AWS_REGION ?? 'us-east-1'
				} from the environment variable AWS_REGION is not in the list of supported regions!`,
			),
		)
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(`CDK might not be able to successfully deploy.`),
		)
	}
}
