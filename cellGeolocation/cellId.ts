export enum NetworkMode {
	LTEm = 'ltem',
	NBIoT = 'nbiot',
}

export const cellId = ({
	nw,
	area,
	mccmnc,
	cell,
}: {
	nw: NetworkMode
	area: number
	mccmnc: number
	cell: number
}): string => `${nw}-${cell}-${mccmnc}-${area}`
