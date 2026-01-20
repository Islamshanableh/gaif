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

    // Oracle Database
    ORACLE_USER: Joi.string().required().description('Oracle database user'),
    ORACLE_PASSWORD: Joi.string().required().description('Oracle database password'),
    ORACLE_CONNECTION_STRING: Joi.string().required().description('Oracle connection string'),
    ORACLE_WALLET_LOCATION: Joi.string().allow('').description('Oracle wallet location for ADB'),

    // AWS
    AWS_ACCESS_KEY_ID: Joi.string().allow(''),
    AWS_SECRET_ACCESS_KEY: Joi.string().allow(''),
    AWS_BUCKET_NAME_UPLOAD: Joi.string().required(),
    AWS_REGION: Joi.string().required(),
    AWS_EXP_IN: Joi.number().required(),
    AWS_PREFIX: Joi.string().required(),
    CDN_PREFIX: Joi.string().required(),

    // Email Configuration
    EMAIL_SERVICE: Joi.string().default('gmail').description('Email service provider'),
    EMAIL_HOST: Joi.string().allow('').description('SMTP host'),
    EMAIL_PORT: Joi.number().default(587).description('SMTP port'),
    EMAIL_SECURE: Joi.boolean().default(false).description('Use TLS'),
    EMAIL_USER: Joi.string().required().description('Email username'),
    EMAIL_PASSWORD: Joi.string().required().description('Email password'),
    EMAIL_FROM_NAME: Joi.string().default('GAIF 2026').description('Email from name'),

    // URLs
    FRONTEND_URL: Joi.string().default('https://gaif2026.com').description('Frontend base URL'),
    API_URL: Joi.string().default('https://api.gaif2026.com/api/v1').description('API base URL'),

    // Logo URLs
    GAIF_LOGO_URL: Joi.string().allow('').default('').description('GAIF logo URL'),
    JIF_LOGO_URL: Joi.string().allow('').default('').description('JIF logo URL'),

    // External Links
    UPDATE_REGISTRATION_URL: Joi.string().allow('').default('').description('Update registration URL'),
    PAYMENT_URL: Joi.string().allow('').default('').description('Payment URL'),
    VISA_FORM_URL: Joi.string().allow('').default('').description('Visa form URL'),
    PARTNERS_URL: Joi.string().allow('').default('').description('Partners page URL'),
    PARTNERSHIP_OPPORTUNITIES_URL: Joi.string().allow('').default('').description('Partnership opportunities URL'),
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

  oracle: {
    user: envVars.ORACLE_USER,
    password: envVars.ORACLE_PASSWORD,
    connectionString: envVars.ORACLE_CONNECTION_STRING,
    walletLocation: envVars.ORACLE_WALLET_LOCATION,
  },

  aws: {
    access_key_id: envVars.AWS_ACCESS_KEY_ID,
    secret_access_key: envVars.AWS_SECRET_ACCESS_KEY,
    bucket_name: envVars.AWS_BUCKET_NAME_UPLOAD,
    region: envVars.AWS_REGION,
    exp_in: envVars.AWS_EXP_IN,
    prefix: envVars.AWS_PREFIX,
  },

  email: {
    service: envVars.EMAIL_SERVICE,
    host: envVars.EMAIL_HOST,
    port: envVars.EMAIL_PORT,
    secure: envVars.EMAIL_SECURE,
    user: envVars.EMAIL_USER,
    password: envVars.EMAIL_PASSWORD,
    fromName: envVars.EMAIL_FROM_NAME,
  },

  urls: {
    frontend: envVars.FRONTEND_URL,
    api: envVars.API_URL,
    gaifLogo: envVars.GAIF_LOGO_URL,
    jifLogo: envVars.JIF_LOGO_URL,
    updateRegistration: envVars.UPDATE_REGISTRATION_URL,
    payment: envVars.PAYMENT_URL,
    visaForm: envVars.VISA_FORM_URL,
    partners: envVars.PARTNERS_URL,
    partnershipOpportunities: envVars.PARTNERSHIP_OPPORTUNITIES_URL,
  },
};
