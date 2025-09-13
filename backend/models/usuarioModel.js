const db = require('../config/db');

const Usuario = {
    criar: (usuario, callback) => {
        const sql = 'INSERT INTO usuarios (nome, senha) VALUES (?, ?)';
        db.query(sql, [usuario.nome, usuario.senha], callback);
    }
};

module.exports = Usuario;
