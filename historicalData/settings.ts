import { CORE_STACK_NAME } from '../cdk/stacks/stackId'

export const DataBaseName = (): string =>
	`${CORE_STACK_NAME.replace(/-/g, '_')}_historicaldata`

export const UpdatesTableName = (): string =>
	`${CORE_STACK_NAME.replace(/-/g, '_')}_deviceupdates`

export const DocumentsTableName = (): string =>
	`${CORE_STACK_NAME.replace(/-/g, '_')}_devicedocuments`

export const WorkGroupName = (): string => CORE_STACK_NAME
