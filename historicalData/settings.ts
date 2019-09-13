export const DataBaseName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName.replace(/-/g, '_')}_historicaldata`

export const TableName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName.replace(/-/g, '_')}_devicedata`

export const WorkGroupName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => bifravstStackName
