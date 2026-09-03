const {
    listarNotificacoes,
    contarNaoLidas,
    marcarComoLida,
    marcarTodasComoLidas
} = require('../services/notificationServiceClientExterno'); // ajuste o path se necessário

exports.listar = async (req, res) => {
    try {
        const clinicaId = req.usuario.clinica_id;
        const notificacoes = await listarNotificacoes(clinicaId);
        res.json(notificacoes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao listar notificações' });
    }
};

exports.contar = async (req, res) => {
    try {
        const clinicaId = req.usuario.clinica_id;
        const total = await contarNaoLidas(clinicaId);
        res.json({ total });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao contar notificações' });
    }
};

exports.marcarLida = async (req, res) => {
    try {
        const { id } = req.params;
        const clinicaId = req.usuario.clinica_id;
        await marcarComoLida(id, clinicaId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao marcar como lida' });
    }
};

exports.marcarTodasLidas = async (req, res) => {
    try {
        const clinicaId = req.usuario.clinica_id;
        await marcarTodasComoLidas(clinicaId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao marcar todas como lidas' });
    }
};