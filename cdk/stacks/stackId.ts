const STACK_ID = process.env.STACK_ID ?? 'bifravst'
export const CORE_STACK_NAME = STACK_ID
export const WEBAPPS_STACK_NAME = `${STACK_ID}-webapps`
export const SOURCECODE_STACK_NAME = `${STACK_ID}-sourcecode`
export const CONTINUOUS_DEPLOYMENT_STACK_NAME = `${STACK_ID}-continuous-deployment`
export const FIRMWARE_CI_STACK_NAME = `${STACK_ID}-firmware-ci`
