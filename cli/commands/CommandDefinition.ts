export type ComandDefinition = {
	command: string
	action: (...args: any) => Promise<void>
	options?: { flags: string; description?: string; defaultValue?: any }[]
	help: string
}
