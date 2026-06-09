import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import IhFhirModuleService from '@src/services/IhFhirModuleService';

async function getAll(_: IReq, res: IRes) {
  const ihFhirModule = await IhFhirModuleService.getAll();
  const fhirModules = (ihFhirModule ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    [item.key]: Boolean(item.is_enabled),
  }));

  return res.status(HttpStatusCodes.OK).json({ fhir_modules: fhirModules });
}

async function updateIsEnabled(req: IReqUser<{ fhir?: boolean, shr?: boolean }>, res: IRes) {
  const { id } = req.params;
  const { fhir, shr } = req.body;
  const { userId, name } = req.user.data;
  const providedStatuses = [fhir, shr].filter((status) => typeof status === 'boolean');

  if (providedStatuses.length !== 1) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({ error: 'One boolean status must be provided for either fhir or shr' });
  }

  await IhFhirModuleService.updateIsEnabled(id, providedStatuses[0], userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

async function updateName(req: IReqUser<{ lang: any }>, res: IRes) {
  const { id } = req.params;
  const { userId, name } = req.user.data;
  const { lang } = req.body;
  await IhFhirModuleService.updateName(id, lang, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

async function updateOrder(req: IReqUser<{ order: any }>, res: IRes) {
  const { userId, name } = req.user.data;
  const { order } = req.body;
  await IhFhirModuleService.updateOrder(order, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

async function updateSubSectionIsEnabled(req: IReqUser<{ is_enabled: boolean, sub_section: string }>, res: IRes) {
  const { id } = req.params;
  const { is_enabled, sub_section } = req.body;
  const { userId, name } = req.user.data;
  await IhFhirModuleService.updateSubSectionIsEnabled(id, sub_section, is_enabled, userId, name);
  return res.status(HttpStatusCodes.OK).json({ success: true, data: null });
}

export default {
  getAll,
  updateIsEnabled,
  updateName,
  updateOrder,
  updateSubSectionIsEnabled,
} as const;
