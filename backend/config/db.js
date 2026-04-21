const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'db',           // nome do serviço no docker-compose
    user: 'root',
    password: 'root',
    database: 'terapia_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // --- ADICIONE ESTAS DUAS LINHAS PARA CORRIGIR O FUSO ---
    timezone: '-03:00',
    dateStrings: true,
    typeCast: function (field, next) {
        if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
            return field.string(); // Garante que o MySQL entregue o texto puro
        }
        return next();
    }
});

module.exports = pool;