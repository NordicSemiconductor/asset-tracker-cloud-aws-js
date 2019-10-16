export const DataBaseName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName.replace(/-/g, '_')}_historicaldata`

export const UpdatesTableName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName.replace(/-/g, '_')}_deviceupdates`

export const DocumentsTableName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => `${bifravstStackName.replace(/-/g, '_')}_devicedocuments`

export const WorkGroupName = ({
	bifravstStackName,
}: {
	bifravstStackName: string
}) => bifravstStackName
