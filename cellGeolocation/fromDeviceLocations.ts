import {
    DynamoDBClient,
    QueryCommand,
} from '@aws-sdk/client-dynamodb-v2-node';
import { cellId } from '@bifravst/cell-geolocation-helpers';
import { CelGeoResponse } from './CelGeoResponse';
import { CelGeoInput } from './CelGeoInput';

const TableName = process.env.LOCATIONS_TABLE || ''
const IndexName = process.env.LOCATIONS_TABLE_CELLID_INDEX || ''
const dynamodb = new DynamoDBClient({})

export const handler = async ({ roaming: cell }: CelGeoInput): Promise<CelGeoResponse> => {
    console.log({
        cell
    })
    const { Items } = await dynamodb.send(
        new QueryCommand({
            TableName,
            IndexName,
            KeyConditionExpression: 'cellId = :cellId',
            ExpressionAttributeValues: {
                [':cellId']: {
                    S: cellId(cell),
                },
            },
            ProjectionExpression: 'lat,lng',
        }),
    );


    if (Items?.length) {
        // Calculate the center of the cell as the median of all lat and lng measurements on record
        const lats = Items.map(({ lat }) => parseFloat(lat.N as string)).sort()
        const lngs = Items.map(({ lng }) => parseFloat(lng.N as string)).sort()

        console.log(JSON.stringify({
            cell,
            lats,
            lngs
        }))

        return {
            ...cell,
            located: true,
            lat: lats[Math.floor(lats.length / 2)],
            lng: lngs[Math.floor(lngs.length / 2)]
        }
    }
    return {
        ...cell,
        located: false,
    }
}