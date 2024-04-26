import { RouteError } from '@src/other/classes';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { Specialization } from '@src/models/specialization.model';
import { Config } from '@src/models/dic_config.model';
import { ProviderAttribute } from '@src/models/provider_attribute.model';
import { Sequelize } from 'sequelize';
import { AuditTrail } from '@src/models/audit_trail.model';


// **** Variables **** //

export const SPECIALIZATION_NOT_FOUND_ERR = 'Specialization not found';
export const ATLEAST_ONE_SPECIALIZATION_MUST_BE_ENABLED = 'Atleast one specialization must be enabled';
export const DOCTOR_ASSIGNED_SPECIALIZATION = 'Doctor assigned for this speciality';


// **** Functions **** //

/**
 * Get all specializations.
 */
function getAll(): Promise<Specialization[]> {
  return Specialization.findAll({
    attributes: ['id', 'name', 'key', 'is_enabled', 'createdAt', 'updatedAt'],
    raw: true
  });
}

/**
 * Update specialization enabled status..
 */
async function updateIsEnabled(id: string, is_enabled: boolean, user_id: string, user_name: string): Promise<void> {
  const speciality = await Specialization.findOne({ where: { id } });
  if (!speciality) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      SPECIALIZATION_NOT_FOUND_ERR,
    );
  }

  // Check if new status and current status are same or not, if same don't do anything
  if (speciality.is_enabled === is_enabled) {
    return;
  }

  // Check if atleast one specialization must be enabled at any time before disabling any specialization
  if (!is_enabled) {
    const enabledCount = await Specialization.count({ where: { is_enabled: true } });
    if (enabledCount  === 1) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        ATLEAST_ONE_SPECIALIZATION_MUST_BE_ENABLED,
      );
    }
  }

  // Check if atleast not a single doctor should have the speciality before disabling any specialization
  if (!is_enabled) {
    const doctor_count: any = await ProviderAttribute.findOne({
      attributes: [['value_reference','specialization'], [Sequelize.fn('COUNT', Sequelize.col('value_reference')), 'count']],
      where: {
        attribute_type_id: 7,
        voided: 0,
        value_reference: speciality.name
      },
      group:["value_reference"],
      raw: true
    });

    if (doctor_count?.count > 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        DOCTOR_ASSIGNED_SPECIALIZATION,
      );
    }
  }

  // Update enabled status
  await Specialization.update({ is_enabled }, { where: { id } });

  // Get enabled specializations
  const enabledSpecializations = await Specialization.findAll({
    attributes: ['name','key'],
    where: { is_enabled: true }
  });

  // Update dic_config specialization
  await Config.update({ value: JSON.stringify(enabledSpecializations), published: false }, { where: { key: 'specialization' } });

  // Insert audit trail entry
  await AuditTrail.create({ user_id, user_name, activity_type: 'SPECIALIZATION STATUS UPDATED', description: `${is_enabled ? 'Enabled':'Disabled'} "${speciality.name}" speciality.` });
}

/**
 * Get specialization wise doctors count.
 */
function getSpecialityWiseDoctorCount(): Promise<any[]> {
  return ProviderAttribute.findAll({
    attributes: [['value_reference','specialization'], [Sequelize.fn('COUNT', Sequelize.col('value_reference')), 'count']],
    where: {
      attribute_type_id: 7,
      voided: 0
    },
    group:["value_reference"],
    raw: true
  });
}

// **** Export default **** //

export default {
  getAll,
  getSpecialityWiseDoctorCount,
  updateIsEnabled
} as const;