import {
	DescribeCACertificateCommand,
	IoTClient,
	ListCACertificatesCommand,
} from '@aws-sdk/client-iot'
import { paginate } from '../../util/paginate.js'
import { fingerprint } from './fingerprint.js'

/**
 * Returns a map of the registered CA IDs and their fingerprints
 */
export const listRegisteredCAs = async ({
	iot,
}: {
	iot: IoTClient
}): Promise<Record<string, string>> => {
	const certs: Record<string, string> = {}

	await paginate({
		paginator: async (marker) => {
			const res = await iot.send(new ListCACertificatesCommand({ marker }))
			for (const { certificateId } of res.certificates ?? []) {
				const description = await iot.send(
					new DescribeCACertificateCommand({
						certificateId: certificateId as string,
					}),
				)
				certs[
					fingerprint(description.certificateDescription?.certificatePem ?? '')
				] = certificateId as string
			}
			return res.nextMarker
		},
	})

	return certs
}
