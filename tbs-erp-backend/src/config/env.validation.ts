import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  // MC-01: Password required in staging and production.
  REDIS_PASSWORD: Joi.when('APP_ENV', {
    is: Joi.valid('staging', 'production'),
    then: Joi.string().min(8).required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  // App
  APP_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  PORT: Joi.number().default(3000),
  CORS_ORIGINS: Joi.string().required(),

  // Encryption
  FIELD_ENCRYPTION_KEY: Joi.string().min(32).required(),
}).options({ allowUnknown: true });
