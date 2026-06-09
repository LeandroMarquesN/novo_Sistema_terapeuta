const Joi = require('joi');
const db = require('../config/db');
const notificacaoService = require('../services/notificationService');
const validator = require('validator');

const palavrasProibidas = ['teste', 'lixo', 'aaaaa', 'asdfgh', 'inapropriado', "werqwer", "retwertret", "cusao", "viado"];

const schemaCadastro = Joi.object({
    nome_clinica: Joi.string().min(3).max(100).required().pattern(/^[a-zA-ZÀ-ÿ\s]+$/),
    responsavel: Joi.string().min(3).max(50).required().pattern(/^[a-zA-ZÀ-ÿ\s]+$/),
    whatsapp: Joi.string().min(10).max(15).pattern(/^[0-9]+$/).required(),
    email: Joi.string().email().required()
});

exports.salvarInteressado = async (req, res) => {
    const { error, value } = schemaCadastro.validate(req.body);

    if (error) return res.status(400).json({ error: "Dados inválidos: " + error.details[0].message });

    const nomeInvalido = palavrasProibidas.some(palavra => value.nome_clinica.toLowerCase().includes(palavra));
    if (nomeInvalido) return res.status(400).json({ error: "Nome de clínica inválido ou inapropriado." });

    try {
        const [existe] = await db.execute("SELECT id FROM lista_espera WHERE email = ?", [value.email.toLowerCase()]);
        if (existe.length > 0) return res.status(409).json({ error: "Este e-mail já está na nossa lista de espera!" });

        // 1. Salva no banco de dados
        await db.execute(
            "INSERT INTO lista_espera (nome_clinica, responsavel, whatsapp, email, status) VALUES (?, ?, ?, ?, 'pendente')",
            [value.nome_clinica.trim(), value.responsavel.trim(), value.whatsapp, value.email.toLowerCase()]
        );

        // 2. Dispara o e-mail em segundo plano
        // Não usamos 'await' aqui para que o servidor responda ao usuário imediatamente
        notificacaoService.sendProgramaFundadoresEmail({
            responsavel: value.responsavel,
            nome_clinica: value.nome_clinica,
            email: value.email
        }).catch(err => console.error("Erro ao enviar e-mail de fundadores:", err));

        // 3. Resposta de sucesso
        res.status(201).json({ message: "Sucesso! Sua vaga foi solicitada." });

    } catch (error) {
        console.error("Erro no controller:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};