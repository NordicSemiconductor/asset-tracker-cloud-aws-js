import type { Static } from '@sinclair/typebox'
import ajvLib from 'ajv'
const Ajv = ajvLib.default
import { groundFixRequestSchema } from './groundFixRequestSchema.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

const ajv = new Ajv()

void describe('groundFixRequestSchema', () => {
	void it('should throw error if a request with only 1 wifi access point', () => {
		const v = ajv.compile(groundFixRequestSchema)
		const request: Static<typeof groundFixRequestSchema> = {
			wifi: {
				accessPoints: [
					{
						macAddress: '40:01:7a:c9:10:22',
					},
				],
			},
		}
		const valid = v(request)
		assert.notEqual(v.errors, null)
		assert.equal(valid, false)
	})

	void it('should validate a request with 2 wifi access points as minimum requirements', () => {
		const v = ajv.compile(groundFixRequestSchema)
		const request: Static<typeof groundFixRequestSchema> = {
			wifi: {
				accessPoints: [
					{
						macAddress: '40:01:7a:c9:10:22',
						ssid: 'TnGroup',
					},
					{
						macAddress: '80:e0:1d:2a:92:f2',
					},
					{
						macAddress: '40:01:7A:C9:10:21',
					},
				],
			},
		}
		const valid = v(request)
		assert.equal(v.errors, null)
		assert.equal(valid, true)
	})

	void it('should validate a request with full details of wifi access points', () => {
		const v = ajv.compile(groundFixRequestSchema)
		const request: Static<typeof groundFixRequestSchema> = {
			wifi: {
				accessPoints: [
					{
						macAddress: '40:01:7a:c9:10:22',
						ssid: 'TnGroup',
						signalStrength: -65,
						channel: 1,
					},
					{
						macAddress: '80:e0:1d:2a:92:f2',
						ssid: 'TnGroup',
						signalStrength: -70,
						channel: 1,
					},
					{
						macAddress: '40:01:7a:c9:10:21',
						ssid: 'Telenor_Guest',
						signalStrength: -65,
						channel: 1,
					},
					{
						macAddress: '40:01:7a:c9:10:27',
						ssid: 'TnNorgeMacOS',
						signalStrength: -65,
						channel: 1,
					},
					{
						macAddress: '80:e0:1d:2a:92:f1',
						ssid: 'Telenor_Guest',
						signalStrength: -69,
						channel: 1,
					},
					{
						macAddress: '80:e0:1d:2a:92:f5',
						ssid: 'TnNorge',
						signalStrength: -69,
						channel: 1,
					},
					{
						macAddress: '96:15:44:ac:6c:87',
						ssid: 'Geotek',
						signalStrength: -71,
						channel: 1,
					},
					{
						macAddress: '7c:10:c9:02:b8:68',
						ssid: 'PTU_TEST',
						signalStrength: -64,
						channel: 8,
					},
					{
						macAddress: '9a:15:44:ac:6c:6e',
						ssid: 'Pets',
						signalStrength: -68,
						channel: 11,
					},
					{
						macAddress: '4c:e1:75:bf:e2:a0',
						ssid: 'NORDIC-GUEST',
						signalStrength: -41,
						channel: 11,
					},
					{
						macAddress: '4c:e1:75:bf:e2:a1',
						ssid: 'NORDIC-INTERNAL',
						signalStrength: -41,
						channel: 11,
					},
					{
						macAddress: '82:15:44:ac:6b:1f',
						ssid: 'Geogjest',
						signalStrength: -75,
						channel: 11,
					},
					{
						macAddress: '82:15:54:ac:6c:6e',
						ssid: 'Geogjest',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: '86:15:54:ac:6c:6e',
						ssid: 'Geoprosjekt',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: '9a:15:54:ac:6c:6e',
						ssid: 'Pets',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: '9e:15:54:ac:6c:6e',
						ssid: 'Geoccast',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: '96:15:54:ac:6c:6e',
						ssid: 'Geotek',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: 'b6:15:54:ac:6c:6e',
						signalStrength: -85,
						channel: 36,
					},
					{
						macAddress: '7c:10:c9:02:b8:6c',
						ssid: 'PTU_TEST_5G',
						signalStrength: -62,
						channel: 36,
					},
					{
						macAddress: '80:e0:1d:2a:92:fd',
						ssid: 'TnGroup',
						signalStrength: -84,
						channel: 36,
					},
					{
						macAddress: '80:e0:1d:2a:92:f9',
						ssid: 'Telenor_Linx',
						signalStrength: -84,
						channel: 36,
					},
					{
						macAddress: '80:e0:1d:2a:92:f8',
						ssid: 'TnNorgeMacOS',
						signalStrength: -84,
						channel: 36,
					},
					{
						macAddress: '8a:15:54:ac:6c:6e',
						ssid: 'Geoikt',
						signalStrength: -86,
						channel: 36,
					},
					{
						macAddress: 'fe:cb:ac:8f:77:3f',
						ssid: 'Geotek',
						signalStrength: -85,
						channel: 48,
					},
					{
						macAddress: '80:e0:1d:02:2e:2d',
						ssid: 'TnGroup',
						signalStrength: -83,
						channel: 48,
					},
					{
						macAddress: '80:e0:1d:02:2e:2e',
						ssid: 'Telenor_Guest',
						signalStrength: -84,
						channel: 48,
					},
					{
						macAddress: 'f6:cb:ac:8f:77:3f',
						ssid: 'Geoccast',
						signalStrength: -84,
						channel: 48,
					},
					{
						macAddress: '4c:e1:75:bf:09:2f',
						ssid: 'NORDIC-GUEST',
						signalStrength: -68,
						channel: 116,
					},
					{
						macAddress: '4c:e1:75:bf:e2:af',
						ssid: 'NORDIC-GUEST',
						signalStrength: -46,
						channel: 132,
					},
					{
						macAddress: '4c:e1:75:bf:e2:ae',
						ssid: 'NORDIC-INTERNAL',
						signalStrength: -46,
						channel: 132,
					},
				],
			},
		}
		const valid = v(request)
		assert.equal(v.errors, null)
		assert.equal(valid, true)
	})

	void it('should validate a neighboring cell request', () => {
		const v = ajv.compile(groundFixRequestSchema)
		const request: Static<typeof groundFixRequestSchema> = {
			lte: [
				{
					mcc: 242,
					mnc: 1,
					eci: 1234,
					tac: 1234,
					earfcn: 6446,
					adv: 80,
					rsrp: -97,
					rsrq: -9,
					nmr: [
						{
							earfcn: 262142,
							pci: 501,
							rsrp: -104,
							rsrq: -18,
						},
						{
							earfcn: 262141,
							pci: 503,
							rsrp: -116,
							rsrq: -11,
						},
					],
				},
			],
		}
		const valid = v(request)
		assert.equal(v.errors, null)
		assert.equal(valid, true)
	})

	void it('should validate a cell geo location request', () => {
		const v = ajv.compile(groundFixRequestSchema)
		const valid = v({
			lte: [
				{
					eci: 23820260,
					mcc: 460,
					mnc: 0,
					tac: 24327,
				},
			],
		})
		assert.equal(v.errors, null)
		assert.equal(valid, true)
	})
})
