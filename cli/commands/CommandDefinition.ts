export type CommandDefinition = {
	command: string
	action: (...args: any) => Promise<void>
	options?: { flags: string; description?: string; defaultValue?: any }[]
	help: string
}
