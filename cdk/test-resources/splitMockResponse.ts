export const splitMockResponse = (
	r: string,
): { headers: Record<string, string>; body: string } => {
	const lines = r.split('\n').map((s) => s.trim())
	const firstBlank = lines.indexOf('')
	if (firstBlank === -1)
		return {
			headers: {},
			body: r,
		}
	return {
		headers: lines
			.slice(0, firstBlank)
			.map((s) => s.split(':', 2))
			.reduce((headers, [k, v]) => ({ ...headers, [k]: v.trim() }), {}),
		body: lines.slice(firstBlank + 1).join('\n'),
	}
}
