require('dotenv').config();
module.exports = {
    development: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        dialect: 'mysql',
        logging: false
    },
    test: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        dialect: 'mysql',
        logging: false
    },
    production: {
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        host: process.env.MYSQL_HOST,
        dialect: 'mysql',
        logging: false
    }
};