/**
 * Remove old files, copy front-end ones.
 */

import fs, { CopyOptions } from 'fs-extra';
import logger from 'jet-logger';
import childProcess from 'child_process';
import path from 'path';


/**
 * Start
 */
(async () => {
  try {
    // Remove current build
    await removeExceptPublicConfigs();
    // Copy front-end files except 'configs' in 'public'
    await copy('./src/public', './dist/public', {
      filter: (src) => {
        return !src.includes('/configs') && !src.includes('\\configs');
      }
    });

    await copy('./src/views', './dist/views', {});
    
    // Copy .pem directory if it exists
    const pemSourcePath = process.env.PEM_SOURCE_PATH || './src/.pem';
    if (await fs.pathExists(pemSourcePath)) {
      await copy(pemSourcePath, './dist/.pem', {});
    }
    
    // Copy environment files
    await copy('./env', './dist/env', {});
    // Copy back-end files
    await exec('tsc --build tsconfig.prod.json', './');
  } catch (err) {
    logger.err(err);
    process.exit(1);
  }
})();

async function removeExceptPublicConfigs() {
  const distPath = path.resolve('./dist');
  const preservePath = path.join(distPath, 'public', 'configs');

  // Check if dist exists
  if (await fs.pathExists(distPath)) {
    const items = await fs.readdir(distPath);

    for (const item of items) {
      const fullPath = path.join(distPath, item);

      // Skip 'public/configs' folder
      if (fullPath.startsWith(preservePath)) {
        continue;
      }

      // eslint-disable-next-line max-len
      // Special handling: if it's 'public', we need to remove everything inside except 'configs'
      if (item === 'public') {
        const publicItems = await fs.readdir(fullPath);
        for (const subItem of publicItems) {
          const subItemPath = path.join(fullPath, subItem);
          if (subItemPath !== preservePath) {
            await fs.remove(subItemPath);
          }
        }
      } else {
        await fs.remove(fullPath);
      }
    }
  }
}

/**
 * Copy file.
 */
function copy(src: string, dest: string, options: CopyOptions): Promise<void> {
  return new Promise((res, rej) => {
    return fs.copy(src, dest, options, (err) => {
      return (!!err ? rej(err) : res());
    });
  });
}

/**
 * Do command line command.
 */
function exec(cmd: string, loc: string): Promise<void> {
  return new Promise((res, rej) => {
    return childProcess.exec(cmd, {cwd: loc}, (err, stdout, stderr) => {
      if (!!stdout) {
        logger.info(stdout);
      }
      if (!!stderr) {
        logger.warn(stderr);
      }
      return (!!err ? rej(err) : res());
    });
  });
}
