import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { IhFhirModule } from '@src/models/mst_ih_fhir_module.model';
import connection from '@src/database/connection';

export const IH_FHIR_MODULE_NOT_FOUND_ERR = 'IH FHIR module not found';
export const CANT_UPDATE_ENABLED_STATUS_IF_LOCKED = 'Can not update enable status for default compulsory field';
export const CANT_UPDATE_NAME_IF_EDITABLE_FALSE = 'Can update the name, because its not editable';

const CONFIG_KEY = 'fhir_module';

function getAll(): Promise<IhFhirModule[]> {
  return IhFhirModule.findAll({
    attributes: ['id', 'name', 'lang', 'key', 'is_editable', 'is_enabled', 'is_locked', 'order', 'createdAt', 'updatedAt', 'sub_sections', 'platform'],
    raw: true,
    order: [['order', 'asc']],
  });
}

async function getModulesForConfig(): Promise<IhFhirModule[]> {
  return IhFhirModule.findAll({
    attributes: ['id', 'name', 'lang', 'key', 'is_enabled', 'order', 'sub_sections'],
    order: [['order', 'asc']],
  });
}

function buildFhirModuleConfig(modules: IhFhirModule[], includeMeta = false): Record<string, boolean | number | string> {
  const initialValue: Record<string, boolean | number | string> = includeMeta && modules.length
    ? { id: modules[0].id, name: modules[0].name }
    : {};

  return modules.reduce((acc: Record<string, boolean | number | string>, item: IhFhirModule) => {
    acc[item.key] = Boolean(item.is_enabled);
    return acc;
  }, initialValue);
}

async function updateConfig(): Promise<void> {
  const modules = await getModulesForConfig();
  const value = JSON.stringify(buildFhirModuleConfig(modules));
  const [updatedCount] = await Config.update({ value, published: false }, { where: { key: CONFIG_KEY } });

  if (!updatedCount) {
    await Config.create({
      key: CONFIG_KEY,
      value,
      type: 'json',
      default_value: value,
      published: false,
    });
  }
}

async function getConfig(): Promise<Record<string, boolean | number | string>> {
  const modules = await getModulesForConfig();
  return buildFhirModuleConfig(modules, true);
}

async function updateIsEnabled(id: string, fhir: boolean, user_id: string, user_name: string): Promise<void> {
  const ihFhirModule = await IhFhirModule.findOne({ where: { id } });
  if (!ihFhirModule) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      IH_FHIR_MODULE_NOT_FOUND_ERR,
    );
  }

  if (ihFhirModule.is_locked) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      CANT_UPDATE_ENABLED_STATUS_IF_LOCKED,
    );
  }

  if (ihFhirModule.is_enabled === fhir) {
    await updateConfig();
    return;
  }

  await IhFhirModule.update({ is_enabled: fhir }, { where: { id } });
  await updateConfig();

  await AuditTrail.create({ user_id, user_name, activity_type: 'IH FHIR MODULE ENABLED STATUS UPDATED', description: `${fhir ? 'Enabled' : 'Disabled'} "${ihFhirModule.name}" IH FHIR module.` });
}

async function updateName(id: string, lang: any, user_id: string, user_name: string): Promise<void> {
  const ihFhirModule = await IhFhirModule.findOne({ where: { id } });
  if (!ihFhirModule) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      IH_FHIR_MODULE_NOT_FOUND_ERR,
    );
  }

  if (!ihFhirModule.is_editable) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      CANT_UPDATE_NAME_IF_EDITABLE_FALSE,
    );
  }

  const stringifyLang = JSON.stringify(lang);
  if (JSON.stringify(ihFhirModule.lang) === stringifyLang) {
    return;
  }

  await IhFhirModule.update({ lang }, { where: { id } });
  await updateConfig();

  await AuditTrail.create({ user_id, user_name, activity_type: 'IH FHIR MODULE NAME UPDATED', description: `Old name ${JSON.stringify(ihFhirModule.lang)} New Name ${stringifyLang} IH FHIR module.` });
}

async function updateOrder(order: any[], user_id: string, user_name: string): Promise<void> {
  const oldArr = await IhFhirModule.findAll({
    attributes: ['id', 'order'],
    where: { is_enabled: true },
    order: [['order', 'asc']],
    raw: true,
  });

  function arraysAreEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;

    const map1 = new Map(arr1.map(obj => [obj.id, obj.order]));
    return arr2.every((obj) => map1.get(obj.id) === obj.order);
  }

  if (arraysAreEqual(oldArr, order)) return;

  const updates = order.map(item => `WHEN id = ${item.id} THEN ${item.order}`).join(' ');
  const query = `UPDATE mst_ih_fhir_module SET \`order\` = CASE ${updates} END WHERE id IN (${order.map(item => item.id).join(', ')});`;

  await connection.query(query);
  await updateConfig();

  await AuditTrail.create({ user_id, user_name, activity_type: 'IH FHIR MODULE ORDER UPDATED', description: `Old order ${JSON.stringify(oldArr)} New order ${JSON.stringify(order)} IH FHIR module.` });
}

async function updateSubSectionIsEnabled(id: string, sub_section: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const ihFhirModule = await IhFhirModule.findOne({ where: { id } });
  if (!ihFhirModule) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      IH_FHIR_MODULE_NOT_FOUND_ERR,
    );
  }

  if (ihFhirModule.is_locked) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      CANT_UPDATE_ENABLED_STATUS_IF_LOCKED,
    );
  }

  const sub_sections = ihFhirModule.sub_sections;
  if (sub_sections) {
    sub_sections.forEach((obj: any) => {
      if (obj.name === sub_section) {
        obj.is_enabled = is_enabled;
      }
    });
  }

  await IhFhirModule.update({ sub_sections }, { where: { id } });
  await updateConfig();

  await AuditTrail.create({ user_id, user_name, activity_type: 'IH FHIR MODULE SUB SECTION ENABLED STATUS UPDATED', description: `${is_enabled ? 'Enabled' : 'Disabled'} "${sub_section}" IH FHIR module.` });
}

export default {
  getAll,
  getConfig,
  updateIsEnabled,
  updateName,
  updateOrder,
  updateSubSectionIsEnabled,
} as const;
