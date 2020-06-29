import { stackId } from '../cdk/stacks/stackId'

export const DataBaseName = (): string =>
	`${stackId().replace(/-/g, '_')}_historicaldata`

export const UpdatesTableName = (): string =>
	`${stackId().replace(/-/g, '_')}_deviceupdates`

export const DocumentsTableName = (): string =>
	`${stackId().replace(/-/g, '_')}_devicedocuments`

export const WorkGroupName = (): string => stackId()
