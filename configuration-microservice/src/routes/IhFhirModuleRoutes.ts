import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';
import { IReqUser } from './types/types';
import IhFhirModuleService from '@src/services/IhFhirModuleService';

async function getAll(_: IReq, res: IRes) {
  const fhirModule = await IhFhirModuleService.getConfig();
  return res.status(HttpStatusCodes.OK).json({ fhir_module: fhirModule });
}

async function updateIsEnabled(req: IReqUser<{ fhir: boolean }>, res: IRes) {
  const { id } = req.params;
  const { fhir } = req.body;
  const { userId, name } = req.user.data;
  await IhFhirModuleService.updateIsEnabled(id, fhir, userId, name);
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
