# Configuration Scripts Documentation

This document describes the post-build and post-start scripts that automatically generate configuration files from the `dst_configs` table and add entries to the `dst_publish` table.

## Overview

The configuration system consists of three main components:

1. **post-build.ts** - Runs after the build process to generate config files
2. **post-start.ts** - Runs after the application starts to generate config files
3. **config-generator.ts** - Core utility for generating configuration files with various options

## Scripts

### Post-Build Script (`post-build.ts`)

Automatically runs after the build process to:
- Fetch the last published record from `dst_configs` table
- Generate a configuration file in `./dist/public/configs/`
- Add an entry to the `dst_publish` table

**Usage:**
```bash
npm run build          # Runs build + post-build
npm run postbuild      # Runs only post-build
```

### Post-Start Script (`post-start.ts`)

Runs after the application starts to:
- Check for existing configuration files
- Generate new config files if needed
- Add entries to the `dst_publish` table

**Usage:**
```bash
npm run poststart      # Runs post-start script
```

### Config Generator (`config-generator.ts`)

A flexible utility for generating configuration files with different options:

**Usage:**
```bash
# Generate config from last published record (default)
npm run config:generate
npm run config:last

# Generate config from all published records
npm run config:published

# Generate config from all records
npm run config:all
```

**Programmatic Usage:**
```typescript
import { generateConfig } from './config-generator';

// Generate from last published record
const fileName = await generateConfig({ mode: 'last' });

// Generate from all published records
const fileName = await generateConfig({ mode: 'published' });

// Generate with custom options
const fileName = await generateConfig({
  mode: 'last',
  outputDir: './custom/configs',
  fileName: 'my-config.json',
  addMetadata: true
});
```

## Configuration Modes

### `last` Mode
- Fetches the most recent record from `dst_configs` table
- Creates a single configuration file
- Includes metadata about the source record

### `published` Mode
- Fetches all published records from `dst_configs` table
- Creates a consolidated configuration file
- Each config key becomes a property in the output

### `all` Mode
- Fetches all records from `dst_configs` table (published and unpublished)
- Creates a consolidated configuration file
- Useful for development and testing

## Generated Files

### File Location
Configuration files are generated in: `./dist/public/configs/`

### File Naming
- Format: `config-{timestamp}.json`
- Example: `config-1745219877539.json`

### File Structure

**Single Config (last mode):**
```json
{
  "specialization": [...],
  "language": [...],
  "patient_registration": {...},
  "_metadata": {
    "configId": 123,
    "key": "main_config",
    "type": "json",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "version": 1745219877539
  }
}
```

**Multiple Configs (published/all modes):**
```json
{
  "config_key_1": {...},
  "config_key_2": {...},
  "_metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "version": 1745219877539,
    "configCount": 2,
    "configIds": [123, 124],
    "mode": "published"
  }
}
```

## Database Integration

### dst_configs Table
The scripts read from the `dst_configs` table with the following structure:
- `id` - Primary key
- `key` - Configuration key
- `value` - JSON configuration data
- `type` - Data type
- `published` - Boolean flag for published status
- `createdAt`, `updatedAt` - Timestamps

### dst_publish Table
The scripts add entries to the `dst_publish` table:
- `id` - Primary key
- `name` - Display name for the config
- `path` - File path relative to public directory
- `createdAt`, `updatedAt` - Timestamps

## Error Handling

The scripts include comprehensive error handling:
- Database connection errors
- File system errors
- JSON parsing errors
- Duplicate entry prevention

## Logging

All scripts use the `jet-logger` for consistent logging:
- Info messages for successful operations
- Warning messages for non-critical issues
- Error messages for failures

## Environment Requirements

- Node.js >= 8.10.0
- MySQL database with `dst_configs` and `dst_publish` tables
- Proper environment variables configured in `.env` files

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check environment variables in `.env` files
   - Ensure database is running and accessible
   - Verify table structures exist

2. **No Config Records Found**
   - Check if `dst_configs` table has data
   - Verify `published` flag is set to `true` for published records

3. **File Generation Failed**
   - Check write permissions for `./dist/public/configs/` directory
   - Ensure sufficient disk space

4. **Duplicate Publish Entries**
   - Scripts automatically check for existing entries
   - Duplicate entries are skipped with a warning message

### Debug Mode

To run scripts with more verbose output:
```bash
DEBUG=* npm run postbuild
```

## Integration with Build Process

The post-build script is automatically integrated into the build process:

```json
{
  "scripts": {
    "build": "npx ts-node build.ts && npx ts-node post-build.ts"
  }
}
```

This ensures that configuration files are always generated after a successful build.
