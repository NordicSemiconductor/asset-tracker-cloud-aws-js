import type { LayeredLambdas } from '@nordicsemiconductor/package-layered-lambdas'

export type PackedLambdas<
	A extends {
		[key: string]: string
	},
> = {
	lambdas: LayeredLambdas<A>
	layerZipFileName: string
}
