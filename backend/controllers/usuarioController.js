const Usuario = require('../models/usuarioModel');

exports.criarUsuario = (req, res) => {
    const { nome, senha } = req.body;
    if (!nome || !senha) {
        return res.status(400).json({ erro: 'Nome e senha são obrigatórios' });
    }

    Usuario.criar({ nome, senha }, (err, result) => {
        if (err) {
            console.error('Erro ao criar usuário:', err);
            return res.status(500).json({ erro: 'Erro ao criar usuário' });
        }
        res.status(201).json({ mensagem: 'Usuário criado com sucesso' });
    });
};
