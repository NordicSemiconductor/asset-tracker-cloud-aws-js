import {
    DynamoDBClient,
    GetItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node';
import { cellId } from '@bifravst/cell-geolocation-helpers';
import { CelGeoResponse } from './CelGeoResponse';
import { CelGeoInput } from './CelGeoInput';

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async ({ roaming: cell }: CelGeoInput): Promise<CelGeoResponse> => {
    const id = cellId(cell)
    try {
        const { Item } = await dynamodb.send(
            new GetItemCommand({
                TableName,
                Key: {
                    cellId: {
                        S: id
                    }
                },
                ProjectionExpression: 'lat,lng'
            }),
        );
        if (Item) {
            return {
                located: true,
                ...cell,
                lat: parseFloat(Item.lat.N as string),
                lng: parseFloat(Item.lng.N as string)
            }
        }
        return {
            ...cell,
            located: false,
        }
    } catch (err) {
        if (err.name ===
            'ResourceNotFoundException') {
            console.log(`No cached entry found for ${id}.`)
        } else {
            console.error(JSON.stringify({ error: err }))
        }
        return {
            ...cell,
            located: false,
        }
    }
}