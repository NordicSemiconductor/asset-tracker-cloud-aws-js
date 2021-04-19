import Lambda from '@aws-cdk/aws-lambda'

export const NodeJS14Runtime = new Lambda.Runtime(
	'nodejs14.x',
	Lambda.RuntimeFamily.NODEJS,
	{
		supportsInlineCode: false,
	},
)
