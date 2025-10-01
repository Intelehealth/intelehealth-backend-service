import './pre-start'; // Must be the first import
import logger from 'jet-logger';

import EnvVars from '@src/constants/EnvVars';
import app from './server';
import { NodeEnvs } from './constants/misc';
import connection from './database/connection';
import connectionOpenmrs from './database/connection-openmrs';

/**
 * Normalize a port into a number, string, or false.
 */

const normalizePort = (val: string) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
};

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(EnvVars.Port || '4004');
app.set('port', port);

/**
 * Create HTTP server.
 */

let server;
if (EnvVars.NodeEnv === NodeEnvs.Production.valueOf()) {
  const https = require('https');
  const fs = require('fs');
  const options = {
    key: fs.readFileSync(EnvVars.SslPrivateKey),
    cert: fs.readFileSync(EnvVars.SslCert),
  };
  server = https?.createServer(options, app);
} else {
  const http = require('http');
  server = http?.createServer(app);
}

// Define an asynchronous function to start the server and sync the database
const start = async (): Promise<void> => {
  try {
    await connection.sync(); // Synchronizes the database with the defined models
    await connectionOpenmrs.sync(); // Synchronizes the database with the defined models
    
    // Generate config files at runtime if they don't exist
    try {
      const { generateConfig } = await import('../config-generator');
      logger.info('Generating config files at runtime...');
      await generateConfig({ mode: 'published' });
      logger.info('Config files generated successfully');
    } catch (configError) {
      logger.warn('Failed to generate config files at runtime:', configError);
      // Don't fail the startup if config generation fails
    }
  } catch (error) {
    logger.err(error); // Logs any errors that occur
    process.exit(1); // Exits the process with an error status code
  }
};

void start(); // Invokes the start function to start the server

// **** Run **** //

const SERVER_START_MSG = ('Express server started on port: ' + 
  EnvVars.Port.toString());

server?.listen(port, () => logger.info(SERVER_START_MSG));
