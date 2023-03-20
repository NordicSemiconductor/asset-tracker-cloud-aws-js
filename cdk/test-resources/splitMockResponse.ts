export const splitMockResponse = (
	r: string,
): { headers: Record<string, string>; body: string } => {
	const blankLineLocation = r.indexOf('\n\n')
	if (blankLineLocation === -1)
		return {
			headers: {},
			body: r,
		}
	return {
		headers: r
			.slice(0, blankLineLocation)
			.split('\n')
			.map((s) => s.split(':', 2))
			.reduce((headers, [k, v]) => ({ ...headers, [k ?? '']: v?.trim() }), {}),
		body: r.slice(blankLineLocation + 2),
	}
}
