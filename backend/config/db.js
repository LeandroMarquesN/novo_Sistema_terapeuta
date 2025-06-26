const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'db',           // nome do serviço no docker-compose
    user: 'root',
    password: 'root',
    database: 'terapia_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
