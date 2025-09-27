/**
 * Post-build script to fetch last record from dst_configs table,
 * create config file, and add entry to dst_publish table
 */

import path from 'path';
import dotenv from 'dotenv';
import logger from 'jet-logger';
import { generateConfig } from './config-generator';

// Load environment variables
const result = dotenv.config({
  path: path.join(__dirname, `env/${process.env.NODE_ENV || 'development'}.env`),
});
if (result.error) {
  throw result.error;
}

/**
 * Main function to execute post-build tasks
 */
(async () => {
  try {
    logger.info('Starting post-build process...');
    
    // Generate config using the last published record
    const fileName = await generateConfig({ 
      mode: 'published',
      addMetadata: true
    });
    
    logger.info(`Post-build process completed successfully. Generated: ${fileName}`);
  } catch (err) {
    logger.err('Post-build process failed:', err);
    process.exit(1);
  }
})();
