import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { Publish } from '@src/models/dic_publish.model';

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
async function publish(name: string, path: string): Promise<void> {
  // Create publish record
  await Publish.create({
    name,
    path
  });

  // Update dic_config
  await Config.update({ published: true }, { where: { published: false } });
}

// **** Export default **** //

export default {
    getAll,
    getPublishedConfig,
    publish
  } as const;