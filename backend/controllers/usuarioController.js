// backend/controllers/usuarioController.js

const db = require('../config/db');
const Usuario = require('../models/usuarioModel');

// método para criar usuário
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

// método de login
exports.login = async (req, res) => {
    const { nome, senha } = req.body;

    if (!nome || !senha) {
        return res.status(400).json({ message: 'Nome e senha são obrigatórios' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT * FROM usuarios WHERE nome = ? AND senha = ?',
            [nome, senha]
        );

        if (rows.length > 0) {
            return res.status(200).json({ message: 'Login bem-sucedido' });
        } else {
            return res.status(401).json({ message: 'Nome ou senha incorretos' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ message: 'Erro interno do servidor' });
    }
};
// 🌟 NOVO MÉTODO: Listar profissionais da clínica para o agendamento
exports.listarUsuariosDaClinica = async (req, res) => {
    const clinicaId = req.usuario ? req.usuario.clinica_id : null;

    if (!clinicaId) {
        return res.status(400).json({ erro: 'Clínica não identificada na sessão.' });
    }

    try {
        const [usuarios] = await db.execute(
            'SELECT id, nome, cargo, crm, uf_crm FROM usuarios WHERE clinica_id = ?',
            [clinicaId]
        );
        return res.status(200).json(usuarios);
    } catch (error) {
        console.error('Erro ao listar profissionais da clínica:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar profissionais' });
    }
};