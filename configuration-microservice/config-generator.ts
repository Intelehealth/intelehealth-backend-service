/**
 * Enhanced config generator script that can handle multiple config records
 * and create consolidated config files
 */

import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import logger from 'jet-logger';

dotenv.config();
// Load environment variables FIRST before any other imports - only in development
//const result = dotenv.config({
//  path: process.env.ENV_FILE_PATH ?? path.join(__dirname, `env/${process.env.NODE_ENV || 'development'}.env`),
//});
//if (result.error) {
//  throw result.error;
//}

// Now import database-related modules after environment is loaded
import connection from './src/database/connection';
import { Config } from './src/models/dic_config.model';
import { Publish } from './src/models/dic_publish.model';
import ConfigService from '@src/services/ConfigService';


function parseValue(type:string, value: string) {
  let val: unknown;
  switch (type) {
  case 'array':
    val = JSON.parse(value);
    break;
  case 'json':
    val = JSON.parse(value);
    break;
  case 'number':
    val = Number(value);
    break;
  case 'string':
    val = value;
    break;
  case 'boolean':
    if(!Number.isNaN(Number(value))) {
      val = !!Number(value);
    } else {
      val = value === 'true';
    }
    break;
  default:
    break;
  }
  return val;
}

interface ConfigGeneratorOptions {
  mode: 'all' | 'published';
  outputDir?: string;
  fileName?: string;
  addMetadata?: boolean;
}

/**
 * Main function to generate config files
 */
export async function generateConfig(
  options: ConfigGeneratorOptions = { mode: 'published' },  
): Promise<string> {
  try {
    logger.info('Starting config generation process...');
    
    // Initialize database connection
    await connection.authenticate();
    logger.info('Database connection established');

    // Fetch config records based on mode
    const configs = await fetchConfigRecords(options.mode);
    if (!configs || configs.length === 0) {
      logger.warn('No configuration records found');
      return '';
    }

    logger.info('Found config records');

    // Generate config file
    const fileName = await createConfigFile(configs, options);
    if (fileName) {
      logger.info(`Config file generated: ${fileName}`);

      // Add entry to dst_publish table only if file was generated successfully
      await addPublishEntry(fileName);
      logger.info('Entry added to dst_publish table');
    } else {
      logger.warn('No config file generated, skipping database entry');
      return '';
    }

    logger.info('Config generation process completed successfully');
    return fileName || '';
  } catch (err) {
    logger.err('Config generation process failed:', true);
    // eslint-disable-next-line no-console
    console.error('Detailed error:', err);
    throw err;
  } finally {
    // Close database connection
    await connection.close();
  }
}

/**
 * Fetch config records based on mode
 */
async function fetchConfigRecords(
  mode: 'all' | 'published',
): Promise<Config[]|null> {
  try {
    const queryOptions: {
      where?: { published?: boolean };
    } = {};

    switch (mode) {
    case 'published':
      queryOptions.where = { published: true };
      break;
    case 'all':
    default:
      // No where clause - fetch all records
      break;
    }
    
    const config = await Config.findAll(queryOptions);
    return config;
  } catch (error) {
    logger.err('Error fetching config records:', true);
    // eslint-disable-next-line no-console
    console.error('Detailed error:', error);
    throw error;
  }
}

/**
 * Create config file from the fetched data
 */
async function createConfigFile(
  configs: Config[],
  options: ConfigGeneratorOptions,
): Promise<string> {
  try {
    const outputDir = options.outputDir || './dist/public/configs';
    await fs.ensureDir(outputDir);

    // Process single config
    const configData: Record<string, unknown> = {};

    for (const item of configs) {
      const key = item.key;
      try {
        configData[key] = parseValue(item.type, item.value);
      } catch (error) {
        logger.err('Error parsing config value:', true);
        // eslint-disable-next-line no-console
        console.error('Detailed error:', error);
        throw error;
      }
    }

    const version = await ConfigService.getMaxIdPublish() ?? 0;
    configData.version = version + 1;
    const tmpDir = path.join(__dirname, 'dist/public/configs');
    await fs.ensureDir(tmpDir);
    const outputFilename = `config-${new Date().valueOf()}`;
    const outputFileExtension = 'json';
    const outputFileDir = path.join(
      tmpDir,
      `${outputFilename}.${outputFileExtension}`,
    );
    // Write config file
    await fs.writeJson(outputFileDir, configData, { spaces: 2 });
    
    return outputFilename;
  } catch (error) {
    logger.err('Error creating config file:', true);
    // eslint-disable-next-line no-console
    console.error('Detailed error:', error);
    throw error;
  }
}

/**
 * Add entry to dst_publish table
 */
async function addPublishEntry(fileName: string): Promise<void> {
  try {
    const configPath = path.join(
      __dirname,
      'dist',
      'public',
      'configs',
      `${fileName}.json`,
    );
    
    // Check if entry already exists
    const existingEntry = await Publish.findOne({
      where: {
        path: configPath,
      },
    });

    if (existingEntry) {
      logger.info(`Publish entry already exists for path: ${configPath}`);
      return;
    }

    // Create new publish entry
    await Publish.create({
      name: fileName,
      path: configPath,
    });

    logger.info(`Publish entry created for: ${configPath}`);
  } catch (error) {
    logger.err('Error adding publish entry:', true);
    // eslint-disable-next-line no-console
    console.error('Detailed error:', error);
    throw error;
  }
}

/**
 * CLI interface for the config generator
 */
if (require.main === module) {
  // Get mode from command line argument or default to 'all'
  const mode = (process.argv[2] || 'published') as 'all' | 'published';
  
  // Validate mode
  const validModes = ['all', 'published'];
  if (!validModes.includes(mode)) {
    // eslint-disable-next-line max-len
    logger.err(`Invalid mode: ${mode}. Valid modes are: ${validModes.join(', ')}`, true);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
  
  logger.info(`Generating config for mode: ${mode}`);
  
  generateConfig({ mode })
    .then(fileName => {
      if (fileName) {
        logger.info(`Config file generated: ${fileName}`);
      } else {
        logger.warn('No config file generated');
      }
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    })
    .catch(error => {
      logger.err('Error:', true);
      // eslint-disable-next-line no-console
      console.error('Detailed error:', error);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    });
}
