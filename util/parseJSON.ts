export const parseJSON = (
	json: string,
): { error: Error } | { json: Record<string, any> } => {
	try {
		return JSON.parse(json)
	} catch (error) {
		return { error: error as Error }
	}
}
