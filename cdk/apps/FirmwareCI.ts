import { App } from '@aws-cdk/core'
import { CDKLambdas, PackedLambdas } from '../prepare-resources'
import { FirmwareCIStack } from '../stacks/FirmwareCI'

export class FirmwareCIApp extends App {
	public constructor(args: {
		sourceCodeBucketName: string
		packedCDKLambdas: PackedLambdas<CDKLambdas>
	}) {
		super()

		new FirmwareCIStack(this, args)
	}
}
