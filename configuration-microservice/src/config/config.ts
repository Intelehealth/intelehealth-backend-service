import path from 'path';
import dotenv from 'dotenv';
import { Dialect, Options } from 'sequelize';

// Set the env file
const result2 = dotenv.config({
    path: path.join(__dirname, `../../env/${process.env.NODE_ENV || 'development'}.env`),
});
if (result2.error) {
    throw result2.error;
}

interface ConfigTs {
    development: Options;
    test: Options;
    production: Options;
}

const configDB: ConfigTs = {
    development: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT),
        dialect: process.env.MYSQL_DIALECT as Dialect,
        dialectOptions: {
            charset: 'utf8',
        },
        define: {
            timestamps: false,
        },
    },
    test: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT),
        dialect: process.env.MYSQL_DIALECT as Dialect,
        dialectOptions: {
            charset: 'utf8',
        },
        define: {
            timestamps: false,
        },
    },
    production: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT),
        dialect: process.env.MYSQL_DIALECT as Dialect,
        dialectOptions: {
            charset: 'utf8',
            multipleStatements: true,
        },
        logging: false,
        define: {
            timestamps: false,
        },
    },
};
export default configDB;

module.exports = configDB;