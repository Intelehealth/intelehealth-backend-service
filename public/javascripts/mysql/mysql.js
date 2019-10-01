var mysql = require('mysql');
var settings = require('../mysql/settings');
var db;

connectDatabase = () => {
    if (!db) {
        db = mysql.createConnection(settings);

        db.connect((err) => {
            if(!err) {
                console.log('Database is connected!');
            } else {
                console.log('Error connecting database!');
            }
        });
    }
    return db;
}

module.exports = connectDatabase();