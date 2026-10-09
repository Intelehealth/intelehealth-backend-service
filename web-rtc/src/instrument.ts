import * as dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.DOMAIN || process.env.NODE_ENV || 'development',
});
