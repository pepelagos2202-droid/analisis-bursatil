const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'LRFive5',
    database: 'proyecto_bolsa',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;