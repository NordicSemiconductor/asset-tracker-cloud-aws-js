/**
 * Expands a MAC address written in a form without separators to a form with separators.
 * asset_tracker_v2 sends MACs without separators.
 */
export const expandMac = (mac: string): string => {
	if (!/^[a-f0-9]+$/i.test(mac) || mac.length % 2 !== 0) return mac
	return mac.split('').reduce((expanded, byte, index) => {
		if (index > 0 && index % 2 === 0) expanded += ':'
		expanded += byte
		return expanded
	}, '')
}
