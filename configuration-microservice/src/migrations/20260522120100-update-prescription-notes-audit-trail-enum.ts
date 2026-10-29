import { QueryInterface, DataTypes } from "sequelize";

const PREVIOUS_VALUES = [
  "CONFIG PUBLISHED",
  "SPECIALIZATION STATUS UPDATED",
  "LANGUAGE STATUS UPDATED",
  "LANGUAGE SET AS DEFAULT",
  "PATIENT REGISTRATION FIELD STATUS UPDATED",
  "PATIENT REGISTRATION FIELD MANDATORY STATUS UPDATED",
  "PATIENT REGISTRATION FIELD EDITABLE STATUS UPDATED",
  "THEME CONFIG UPDATED",
  "VITAL ENABLED STATUS UPDATED",
  "VITAL MANDATORY STATUS UPDATED",
  "WEBRTC CONFIG UPDATED",
  "FEATURE CONFIG UPDATED",
  "PATIENT VISIT SUMMARY SECTION STATUS UPDATED",
  "DIAGNOSTIC ENABLED STATUS UPDATED",
  "DIAGNOSTIC MANDATORY STATUS UPDATED",
  "SIDEBAR MENU STATUS UPDATED",
  "PATIENT VISIT SECTION ENABLED STATUS UPDATED",
  "PATIENT VISIT SECTION NAME UPDATED",
  "PATIENT VISIT SECTION ORDER UPDATED",
  "VITAL NAME UPDATED",
  "ROSTER QUESTIONNAIRE CONFIG UPDATED",
  "PATIENT REGISTRATION FIELD VALIDATION UPDATED",
  "DROPDOWN CONFIG UPDATED",
  "HOME SCREEN SECTION NAME UPDATED",
  "HOME SCREEN SECTION ENABLED STATUS UPDATED",
  "AI LLM CONFIG UPDATED",
  "AI LLM RECORDING CONFIG UPDATED",
  "PLATFORM UPDATED",
  "LANGUAGE PLATFORM UPDATED",
];

const NEW_VALUES = [
  ...PREVIOUS_VALUES,
  "PRESCRIPTION NOTES ENABLED STATUS UPDATED",
  "PRESCRIPTION NOTES CONTENT UPDATED",
];

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn("audit_trail", "activity_type", {
        type: DataTypes.ENUM(...NEW_VALUES),
        allowNull: false,
      });
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn("audit_trail", "activity_type", {
        type: DataTypes.ENUM(...PREVIOUS_VALUES),
        allowNull: false,
      });
    }),
};
