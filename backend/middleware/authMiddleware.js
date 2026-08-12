const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
    // Tenta pegar o token do Header OU do Cookie
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});
        token = cookies.token;
    }

    if (!token) {
        if (req.path.includes('/api/')) {
            return res.status(401).json({ error: "Acesso negado." });
        }
        return res.redirect('/login');
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);

        // Confere se esse token ainda é a sessão vigente do usuário.
        // Se outro login sobrescreveu o current_session_token, essa sessão morre.
        const [rows] = await db.execute(
            'SELECT current_session_token FROM usuarios WHERE id = ?',
            [verificado.id]
        );

        if (!rows.length || rows[0].current_session_token !== verificado.sid) {
            if (req.path.includes('/api/')) {
                return res.status(401).json({
                    error: "Sua sessão foi encerrada porque este usuário entrou em outro dispositivo.",
                    codigo: "SESSAO_SUBSTITUIDA"
                });
            }
            return res.redirect('/login?motivo=sessao_substituida');
        }

        req.usuario = verificado;
        next();
    } catch (err) {
        res.redirect('/login');
    }
};