/**
 * Pre-start is where we want to place things that must run BEFORE the express 
 * server is started. This is useful for environment variables, command-line 
 * arguments, and cron-jobs.
 */

// NOTE: DO NOT IMPORT ANY SOURCE CODE HERE
import path from 'path';
import dotenv from 'dotenv';
import { parse } from 'ts-command-line-args';


// **** Types **** //

interface IArgs {
  env: string;
}


// **** Setup **** //

// Command line arguments
const args = parse<IArgs>({
  env: {
    type: String,
    defaultValue: 'development',
    alias: 'e',
  },
});

// Set the env file - load .env files based on environment
if (args.env !== 'production') {
  const result2 = dotenv.config({
    path: path.join(__dirname, `../env/${args.env}.env`),
  });
  if (result2.error) {
    throw result2.error;
  }
} else {
  dotenv.config();
}

// Debug: Log some key environment variables to help with troubleshooting
console.log('🔍 Environment Debug Info:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`MYSQL_HOST: ${process.env.MYSQL_HOST || 'undefined'}`);
console.log(`MYSQL_DB: ${process.env.MYSQL_DB || 'undefined'}`);
console.log(`Total env vars loaded: ${Object.keys(process.env).length}`);