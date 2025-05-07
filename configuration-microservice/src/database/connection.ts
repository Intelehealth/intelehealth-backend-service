// Import the Sequelize module from sequelize-typescript
import EnvVars from '@src/constants/EnvVars';
import { Sequelize } from 'sequelize-typescript';

// Import the Customer model from the ./models module
import { Specialization } from '../models/specialization.model';
import { Vital } from '../models/vital.model';
import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { Language } from '@src/models/language.model';
import { Publish } from '@src/models/dic_publish.model';
import { PatientRegistration } from '@src/models/patient_registration.model';
import { ThemeConfig } from '@src/models/theme_config.model';
import { Webrtc } from '@src/models/mst_webrtc.model';
import { Features } from '@src/models/mst_features.model';
import { PatientVisitSummary } from '@src/models/patient_visit_summary.model';
import { Diagnostics } from '@src/models/diagnostics.model';
import { SidebarMenu } from '@src/models/mst_sidebar_menu.model';
import { PatientVisitSection } from '@src/models/mst_patient_visit_section.model';
import { RosterQuestionnaire } from '@src/models/mst_roster_questionnaire';
import { Dropdown } from '@src/models/mst_dropdown_values.model';
import { AILLM } from '@src/models/mst_ai_llm';
import { HomeScreen } from '@src/models/mst_home_screen.model';

// Create a new Sequelize instance with the connection configuration
const connection = new Sequelize({
  dialect: EnvVars.DbDialect, // Specifies the database dialect
  host: EnvVars.DbHost, // Specifies the database host
  port: EnvVars.DbPort, //Specifies the database port
  username: EnvVars.DbUsername, // Specifies the database username
  password: EnvVars.DbPassword, // Specifies the database password
  database: EnvVars.DbName, // Specifies the database name
  logging: false, // Disables logging of SQL queries
  models: [Specialization, Config, AuditTrail, Language, Publish, PatientRegistration, ThemeConfig, Vital, Diagnostics, Webrtc, Features, PatientVisitSummary, SidebarMenu, PatientVisitSection, RosterQuestionnaire, Dropdown, AILLM, HomeScreen], // Associates the models with this Sequelize instance,
});

// Export the connection object as the default module
export default connection;