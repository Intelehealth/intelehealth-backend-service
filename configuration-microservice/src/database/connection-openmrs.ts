// Import the Sequelize module from sequelize-typescript
import EnvVars from '@src/constants/EnvVars';
import { Sequelize } from 'sequelize-typescript';

// Import the Customer model from the ./models module
import { ProviderAttribute } from '@src/models/provider_attribute.model';

// Create a new Sequelize instance with the connection configuration
const connectionOpenmrs = new Sequelize({
  dialect: EnvVars.DbDialect, // Specifies the database dialect
  host: EnvVars.DbHost, // Specifies the database host
  port: EnvVars.DbPort, //Specifies the database port
  username: EnvVars.DbUsername, // Specifies the database username
  password: EnvVars.DbPassword, // Specifies the database password
  database: EnvVars.DbNameOpenmrs, // Specifies the database name
  logging: false, // Disables logging of SQL queries
  models: [ProviderAttribute], // Associates the models with this Sequelize instance,
});

// Export the connection object as the default module
export default connectionOpenmrs;