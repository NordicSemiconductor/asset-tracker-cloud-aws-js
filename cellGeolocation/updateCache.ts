import {
    DynamoDBClient,
    PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node';
import { cellId } from '@bifravst/cell-geolocation-helpers';
import { CelGeoResponse } from './CelGeoResponse';

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async (cell: CelGeoResponse): Promise<boolean> => {
    const { lat, lng } = cell
    if (!lat || !lng) {
        console.error('lat or lng not defined in', JSON.stringify(cell))
        return false
    }
    await dynamodb.send(
        new PutItemCommand({
            TableName,
            Item: {
                cellId: {
                    S: cellId(cell)
                },
                lat: {
                    N: `${cell.lat}`
                },
                lng: {
                    N: `${cell.lng}`
                }
            },
        }),
    );
    return true
}