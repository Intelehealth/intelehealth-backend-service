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

// Create a new Sequelize instance with the connection configuration
const connection = new Sequelize({
  dialect: EnvVars.DbDialect, // Specifies the database dialect
  host: EnvVars.DbHost, // Specifies the database host
  port: EnvVars.DbPort, //Specifies the database port
  username: EnvVars.DbUsername, // Specifies the database username
  password: EnvVars.DbPassword, // Specifies the database password
  database: EnvVars.DbName, // Specifies the database name
  logging: false, // Disables logging of SQL queries
  models: [Specialization, Config, AuditTrail, Language, Publish, PatientRegistration, ThemeConfig, Vital], // Associates the models with this Sequelize instance,
});

// Export the connection object as the default module
export default connection;