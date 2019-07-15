import { App } from '@aws-cdk/core'
import { BifravstStack } from './BifravstStack'

export class BifravstApp extends App {
	public constructor(args: {
		stackId: string
		account: string
		region: string
	}) {
		super()
		new BifravstStack(this, args.stackId, args)
	}
}
