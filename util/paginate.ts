import { isEmpty } from './isNotEmpty.js'
import { isNullOrUndefined } from './isNullOrUndefined.js'

/**
 * Iteratively follows paginated results.
 * NOTE: This method has no upper runtime limit and may time out.
 */
export const paginate = async ({
	paginator,
	startKey,
}: {
	paginator: (startKey?: any) => Promise<unknown>
	startKey?: any
}): Promise<void> => {
	const nextStartKey = await paginator(startKey)
	if (isNullOrUndefined(nextStartKey)) return
	if (typeof nextStartKey === 'string' && isEmpty(nextStartKey)) return
	await paginate({
		paginator,
		startKey: nextStartKey,
	})
}
