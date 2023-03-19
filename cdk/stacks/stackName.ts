const STACK_NAME = process.env.STACK_NAME ?? 'nrf-asset-tracker'
export const CORE_STACK_NAME = STACK_NAME
export const WEBAPP_STACK_NAME = `${STACK_NAME}-webapp`
export const CONTINUOUS_DEPLOYMENT_STACK_NAME = `${STACK_NAME}-continuous-deployment`
export const FIRMWARE_CI_STACK_NAME = `${STACK_NAME}-firmware-ci`
export const WEBAPP_CI_STACK_NAME = `${STACK_NAME}-web-app-ci`
export const HTTP_MOCK_HTTP_API_STACK_NAME = `${STACK_NAME}-mock-http-api`
