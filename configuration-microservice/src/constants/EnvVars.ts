/**
 * Environments variables declared here.
 */

import { Dialect } from 'sequelize';

/* eslint-disable node/no-process-env */


export default {
  NodeEnv: (process.env.NODE_ENV ?? ''),
  Port: (process.env.PORT ?? 0),
  CookieProps: {
    Key: 'ExpressGeneratorTs',
    Secret: (process.env.COOKIE_SECRET ?? ''),
    // Casing to match express cookie options
    Options: {
      httpOnly: true,
      signed: true,
      path: (process.env.COOKIE_PATH ?? ''),
      maxAge: Number(process.env.COOKIE_EXP ?? 0),
      domain: (process.env.COOKIE_DOMAIN ?? ''),
      secure: (process.env.SECURE_COOKIE === 'true'),
    },
  },
  Jwt: {
    Secret: (process.env.JWT_SECRET ??  ''),
    Exp: (process.env.COOKIE_EXP ?? ''), // exp at the same time as the cookie
  },
  DbDialect: (process.env.MYSQL_DIALECT as Dialect ?? 'mysql'),
  DbPort: (Number(process.env.MYSQL_PORT) ?? 3306),
  DbHost: (process.env.MYSQL_HOST ?? 'localhost'),
  DbUsername: (process.env.MYSQL_USERNAME ?? ''),
  DbPassword: (process.env.MYSQL_PASS ?? ''),
  DbName: (process.env.MYSQL_DB ?? 'mindmap_server'),
  DbNameOpenmrs: (process.env.MYSQL_OPENMRS_DB ?? 'openmrs'),
  SslPrivateKey: process.env.SSL_PRIVATE_KEY,
  SslCert: process.env.SSL_CERT,
  AllowedOrigins: process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : [],
} as const;
