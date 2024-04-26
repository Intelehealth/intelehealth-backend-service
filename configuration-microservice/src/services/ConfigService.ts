import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { Publish } from '@src/models/dic_publish.model';
import { AuditTrail } from '@src/models/audit_trail.model';

// **** Functions **** //

/**
 * Get config.
 */
async function getAll(): Promise<Config[]> {
    return Config.findAll({
      attributes: ['id', 'key', 'value', 'type', 'published']
    });
}

/**
 * Get published config.
 */
async function getPublishedConfig(): Promise<Publish|null> {
  return Publish.findOne({
    order: [['createdAt','DESC'],['id','DESC']]
  });
}

/**
 * Publish config.
 */
async function publish(name: string, path: string, user_id: string, user_name: string, version: number): Promise<void> {
  // Create publish record
  await Publish.create({
    name,
    path
  });

  // Update dic_config
  await Config.update({ published: true }, { where: { published: false } });

  // Insert audit trail entry
  await AuditTrail.create({ user_id, user_name, activity_type: 'CONFIG PUBLISHED', description: `Config version ${version} published.` });
}

/**
 * Get max id config.
 */
async function getMaxIdPublish(): Promise<number> {
  const id = await Publish.max<number, Publish>('id');
  return id
}

// **** Export default **** //

export default {
    getAll,
    getPublishedConfig,
    publish,
    getMaxIdPublish
  } as const;