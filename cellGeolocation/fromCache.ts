import {
    DynamoDBClient,
    GetItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node';
import { cellId } from './cellId';
import { CelGeoResponse } from './CelGeoResponse';
import { CelGeoInput } from './CelGeoInput';

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async ({ roaming: cell }: CelGeoInput): Promise<CelGeoResponse> => {
    const { Item } = await dynamodb.send(
        new GetItemCommand({
            TableName,
            Key: {
                cellId: {
                    S: cellId(cell)
                }
            }
        }),
    );
    if (Item) {
        return {
            located: true,
            lat: parseFloat(Item.lat.N as string),
            lng: parseFloat(Item.lng.N as string)
        }
    }
    return {
        located: false,
    }
}