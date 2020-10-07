const STACK_NAME = process.env.STACK_NAME ?? 'bifravst'
export const CORE_STACK_NAME = STACK_NAME
export const WEBAPPS_STACK_NAME = `${STACK_NAME}-webapps`
export const SOURCECODE_STACK_NAME = `${STACK_NAME}-sourcecode`
export const CONTINUOUS_DEPLOYMENT_STACK_NAME = `${STACK_NAME}-continuous-deployment`
export const FIRMWARE_CI_STACK_NAME = `${STACK_NAME}-firmware-ci`
