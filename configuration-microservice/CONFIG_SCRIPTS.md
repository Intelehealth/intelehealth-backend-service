# Configuration Scripts Documentation

This document describes the post-build script and config generator utility that automatically generate configuration files from the `dic_config` table and add entries to the `dic_publish` table.

## Overview

The configuration system consists of two main components:

1. **post-build.ts** - Runs after the build process to generate config files
2. **config-generator.ts** - Core utility for generating configuration files with various options

## Scripts

### Post-Build Script (`post-build.ts`)

Automatically runs after the build process to:
- Fetch all published records from `dic_config` table
- Generate a consolidated configuration file in `./dist/public/configs/`
- Add an entry to the `dic_publish` table

**Usage:**
```bash
npm run build          # Runs build + post-build
npm run postbuild      # Runs only post-build
```

### Config Generator (`config-generator.ts`)

A flexible utility for generating configuration files with different options:

**Usage:**
```bash
# Generate config from all published records (default)
npm run config:published

# Generate config from all records (published and unpublished)
npm run config:all
```

**Programmatic Usage:**
```typescript
import { generateConfig } from './config-generator';

// Generate from all published records (default)
const fileName = await generateConfig({ mode: 'published' });

// Generate from all records (published and unpublished)
const fileName = await generateConfig({ mode: 'all' });

// Generate with custom options
const fileName = await generateConfig({
  mode: 'published',
  outputDir: './custom/configs',
  fileName: 'my-config.json',
  addMetadata: true
});
```

## Configuration Modes

### `published` Mode (Default)
- Fetches all published records from `dic_config` table
- Creates a consolidated configuration file
- Each config key becomes a property in the output
- Used by the post-build script

### `all` Mode
- Fetches all records from `dic_config` table (published and unpublished)
- Creates a consolidated configuration file
- Useful for development and testing

## Generated Files

### File Location
Configuration files are generated in: `./dist/public/configs/`

### File Naming
- Format: `config-{timestamp}.json`
- Example: `config-1745219877539.json`

### File Structure

**Generated Config Structure:**
```json
{
  "version": 1,
  "config_key_1": {...},
  "config_key_2": {...},
  "config_key_3": {...}
}
```

**Key Features:**
- `version` field: Auto-incremented version number based on the highest ID in `dic_publish` table
- Each configuration key from the database becomes a property
- Values are parsed according to their type (string, number, boolean, array, json)
- All published configurations are consolidated into a single file

## Database Integration

### dic_config Table
The scripts read from the `dic_config` table with the following structure:
- `id` - Primary key (auto-increment)
- `key` - Configuration key (unique, not null)
- `value` - Configuration value as text (nullable)
- `type` - Data type (string, number, boolean, array, json)
- `default_value` - Default value as text (nullable)
- `published` - Boolean flag for published status (default: false)
- `createdAt`, `updatedAt`, `deletedAt` - Timestamps (soft delete enabled)

### dic_publish Table
The scripts add entries to the `dic_publish` table:
- `id` - Primary key (auto-increment)
- `name` - Display name for the config file
- `path` - Full file path to the generated config file
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
- MySQL database with `dic_config` and `dic_publish` tables
- Proper environment variables configured in `.env` files
- TypeScript and ts-node for script execution

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check environment variables in `.env` files
   - Ensure database is running and accessible
   - Verify table structures exist

2. **No Config Records Found**
   - Check if `dic_config` table has data
   - Verify `published` flag is set to `true` for published records
   - Ensure records are not soft-deleted (check `deletedAt` is null)

3. **File Generation Failed**
   - Check write permissions for `./dist/public/configs/` directory
   - Ensure sufficient disk space

4. **Duplicate Publish Entries**
   - Scripts automatically check for existing entries by file path
   - Duplicate entries are skipped with an info message
   - No duplicate entries will be created

5. **Type Parsing Errors**
   - Ensure configuration values match their declared types
   - Check JSON values are valid JSON strings
   - Verify boolean values are properly formatted

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
    "build": "npx ts-node build.ts && npx ts-node -r tsconfig-paths/register post-build.ts"
  }
}
```

This ensures that configuration files are always generated after a successful build.
