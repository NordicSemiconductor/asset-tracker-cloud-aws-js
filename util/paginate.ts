import { isNotNullOrUndefined } from './isNullOrUndefined'

/**
 * Iteratively follows paginated results.
 * NOTE: This method has no upper runtime limit and may time out.
 */
export const paginate = async ({
	paginator,
	startKey,
}: {
	paginator: (startKey?: any) => Promise<unknown | undefined>
	startKey?: any
}): Promise<void> => {
	const nextStartKey = await paginator(startKey)
	if (isNotNullOrUndefined(nextStartKey)) {
		await paginate({
			paginator,
			startKey: nextStartKey,
		})
	}
}
