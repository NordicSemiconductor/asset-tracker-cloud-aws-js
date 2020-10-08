const STACK_NAME = process.env.STACK_NAME ?? 'bifravst'
export const CORE_STACK_NAME = STACK_NAME
export const WEBAPP_STACK_NAME = `${STACK_NAME}-webapp`
export const DEVICEUI_STACK_NAME = `${STACK_NAME}-deviceui`
export const SOURCECODE_STACK_NAME = `${STACK_NAME}-sourcecode`
export const CONTINUOUS_DEPLOYMENT_STACK_NAME = `${STACK_NAME}-continuous-deployment`
export const FIRMWARE_CI_STACK_NAME = `${STACK_NAME}-firmware-ci`
