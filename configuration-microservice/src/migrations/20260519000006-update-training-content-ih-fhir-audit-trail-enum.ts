import { QueryInterface, DataTypes } from 'sequelize';

const previousAuditTrailActivityTypes = [
  'CONFIG PUBLISHED',
  'SPECIALIZATION STATUS UPDATED',
  'LANGUAGE STATUS UPDATED',
  'LANGUAGE SET AS DEFAULT',
  'PATIENT REGISTRATION FIELD STATUS UPDATED',
  'PATIENT REGISTRATION FIELD MANDATORY STATUS UPDATED',
  'PATIENT REGISTRATION FIELD EDITABLE STATUS UPDATED',
  'THEME CONFIG UPDATED',
  'VITAL ENABLED STATUS UPDATED',
  'VITAL MANDATORY STATUS UPDATED',
  'WEBRTC CONFIG UPDATED',
  'FEATURE CONFIG UPDATED',
  'PATIENT VISIT SUMMARY SECTION STATUS UPDATED',
  'DIAGNOSTIC ENABLED STATUS UPDATED',
  'DIAGNOSTIC MANDATORY STATUS UPDATED',
  'SIDEBAR MENU STATUS UPDATED',
  'PATIENT VISIT SECTION ENABLED STATUS UPDATED',
  'PATIENT VISIT SECTION NAME UPDATED',
  'PATIENT VISIT SECTION ORDER UPDATED',
  'VITAL NAME UPDATED',
  'ROSTER QUESTIONNAIRE CONFIG UPDATED',
  'PATIENT REGISTRATION FIELD VALIDATION UPDATED',
  'DROPDOWN CONFIG UPDATED',
  'HOME SCREEN SECTION NAME UPDATED',
  'HOME SCREEN SECTION ENABLED STATUS UPDATED',
  'AI LLM CONFIG UPDATED',
  'AI LLM RECORDING CONFIG UPDATED',
  'PLATFORM UPDATED',
  'LANGUAGE PLATFORM UPDATED',
];

const auditTrailActivityTypes = [
  ...previousAuditTrailActivityTypes,
  'TRAINING CONTENT ENABLED STATUS UPDATED',
  'TRAINING CONTENT NAME UPDATED',
  'IH FHIR MODULE ENABLED STATUS UPDATED',
  'IH FHIR MODULE NAME UPDATED',
  'IH FHIR MODULE ORDER UPDATED',
  'IH FHIR MODULE SUB SECTION ENABLED STATUS UPDATED',
];

module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn(
        'audit_trail',
        'activity_type',
        {
          type: DataTypes.ENUM(...auditTrailActivityTypes),
          allowNull: false,
        },
        { transaction }
      );
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn(
        'audit_trail',
        'activity_type',
        {
          type: DataTypes.ENUM(...previousAuditTrailActivityTypes),
          allowNull: false,
        },
        { transaction }
      );
    }),
};
