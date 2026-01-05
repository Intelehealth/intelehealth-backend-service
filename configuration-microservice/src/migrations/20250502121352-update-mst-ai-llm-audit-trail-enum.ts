import { QueryInterface, DataTypes } from "sequelize";
 
 /** @type {import("sequelize-cli").Migration} */
 module.exports = {
   up: (queryInterface: QueryInterface): Promise<void> =>
     queryInterface.sequelize.transaction(async (transaction) => {
       // here go all migration changes
       await queryInterface.changeColumn("audit_trail", "activity_type", {
         type: DataTypes.ENUM(
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
           "AI LLM CONFIG UPDATED"
         ),
       });
     }),
 
   down: (queryInterface: QueryInterface): Promise<void> =>
     queryInterface.sequelize.transaction(async (transaction) => {
       // here go all migration undo changes
       await queryInterface.changeColumn("audit_trail", "activity_type", {
         type: DataTypes.ENUM(
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
         ),
       });
    }),
}