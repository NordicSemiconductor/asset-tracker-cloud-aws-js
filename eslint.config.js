import config from '@bifravst/eslint-config-typescript'
export default [...config, { ignores: ['dist/**', 'cdk.out/**'] }]
