const path = require('path');
const Joi = require('joi');

// eslint-disable-next-line no-unused-expressions
process.env.NODE_ENV === 'development'
  ? require('dotenv').config({ path: path.join(__dirname, '../.env') })
  : require('dotenv').config({
      path: path.join(__dirname, `../.env.${process.env.NODE_ENV}`),
    });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('production', 'development', 'qa', 'staging')
      .required(),
    PORT: Joi.number().default(3000).description('app port'),
    APP_NAME: Joi.string().required().description('app name'),
    HOST: Joi.string().required().description('app host'),
    HASH_SECRET_KEY: Joi.string().required().description('JWT Secret Key'),
    JWT_ACCESS_EXP_MIN: Joi.string().required(),
    JWT_RESET_EXP_MIN: Joi.string().required(),
    JWT_ACCESS_EXP_HR: Joi.string().required(),
    JWT_REFRESH_EXP_DAYS: Joi.string().required(),
    AWS_ACCESS_KEY_ID: Joi.string().allow(''),
    AWS_SECRET_ACCESS_KEY: Joi.string().allow(''),
    AWS_BUCKET_NAME_UPLOAD: Joi.string().required(),
    AWS_REGION: Joi.string().required(),
    AWS_EXP_IN: Joi.number().required(),
    AWS_PREFIX: Joi.string().required(),
    CDN_PREFIX: Joi.string().required(),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  appName: envVars.APP_NAME,
  host: envVars.HOST,
  cdnPrefix: envVars.CDN_PREFIX,
  jwt: {
    exp_in_min: envVars.JWT_ACCESS_EXP_MIN,
    reset_exp_in_min: envVars.JWT_RESET_EXP_MIN,
    exp_in_hr: envVars.JWT_ACCESS_EXP_HR,
    ref_exp_in_days: envVars.JWT_REFRESH_EXP_DAYS,
  },
  hash: {
    secret: envVars.HASH_SECRET_KEY,
  },
  aws: {
    access_key_id: envVars.AWS_ACCESS_KEY_ID,
    secret_access_key: envVars.AWS_SECRET_ACCESS_KEY,
    bucket_name: envVars.AWS_BUCKET_NAME_UPLOAD,
    region: envVars.AWS_REGION,
    exp_in: envVars.AWS_EXP_IN,
    prefix: envVars.AWS_PREFIX,
  },
};
