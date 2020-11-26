/**
 * Note that not all AWS features are available in all AWS regions.
 * Here we keep a list of regions that are known to work with Bifravst.
 */
export const supportedRegions = [
	'us-east-1',
	'us-east-2',
	'us-west-1',
	'us-west-2',
	'eu-west-1',
]

export const region =
	process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'eu-west-1'
