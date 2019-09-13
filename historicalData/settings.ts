export const DataBaseName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName}_historicaldata`

export const TableName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName}_devicedata`

export const WorkGroupName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => bifravstStackName
