/**
 * Iteratively follows paginated results.
 * NOTE: This method has no upper runtime limit and may time out.
 */
export const paginate = async ({
	paginator,
	startKey,
}: {
	paginator: (startKey?: any) => Promise<any | undefined>
	startKey?: any
}): Promise<void> => {
	const nextStartKey = await paginator(startKey)
	if (nextStartKey) {
		await paginate({
			paginator,
			startKey: nextStartKey,
		})
	}
}
