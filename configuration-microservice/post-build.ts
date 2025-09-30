/**
 * Post-build script to fetch last record from dst_configs table,
 * create config file, and add entry to dst_publish table
 */

import path from 'path';
import dotenv from 'dotenv';
import logger from 'jet-logger';
import { generateConfig } from './config-generator';

// Load environment variables - only in development
// const result = dotenv.config({
//   path: process.env.ENV_FILE_PATH ?? path.join(__dirname, `env/${process.env.NODE_ENV || 'development'}.env`),
// });
// if (result.error) {
//   throw result.error;
// }

dotenv.config();

/**
 * Main function to execute post-build tasks
 */
(async () => {
  try {
    logger.info('Starting post-build process...');
    
    // Generate config using the published records
    const fileName = await generateConfig({ 
      mode: 'published',
    });
    
    logger.info(`Post-build process completed successfully. 
      Generated: ${fileName}`);
  } catch (err) {
    logger.err('Post-build process failed:', true);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
})();
