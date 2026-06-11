// Importe seu serviço de notificações
const notificacaoService = require('../services/notificationService');
const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

// ============================================================
// FUNÇÃO AUXILIAR: GERADOR DE SLUG
// ============================================================
const gerarSlug = (texto) => {
    return texto
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Decompõe caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .replace(/[^a-z0-9 -]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hifens
        .replace(/-+/g, '-'); // Remove hifens duplos
};

// ===========================================
// FUNCAO PARA DAR BOAS VINDAS A NOVA CLINICA
// ===========================================
exports.sendWelcomeEmail = async (clinica) => {
    // ... (Mantenha sua função de e-mail como está, ela está correta)
};

// ============================================================
// 2. A FUNÇÃO DE REGISTRO (ATUALIZADA COM SLUG)
// ============================================================
exports.registerClinica = async (req, res) => {
    const {
        nome_clinica, dono_nome, email_master, senha_master,
        telefone_clinica, telefone_dono, plano_id, origem_cadastro
    } = req.body;

    // 1. Definição lógica baseada na origem
    const isFundador = (origem_cadastro === 'fundador');

    // Calcula datas
    const data_cadastro = new Date();
    const data_expiracao = new Date();

    if (isFundador) {
        data_expiracao.setDate(data_cadastro.getDate() + 90); // 90 dias
    } else {
        data_expiracao.setDate(data_cadastro.getDate() + 7);  // 7 dias padrão
    }

    // Define valores baseados no plano
    const tipo_plano = isFundador ? 'FUNDADOR' : 'PADRAO';
    const valor_atual = isFundador ? 69.90 : 89.90; // Exemplo de diferença de preço
    const status_pagamento = 'trial';

    const slug = gerarSlug(nome_clinica);
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // 2. Inserir a Clínica
        const [resultClinica] = await conn.execute(
            `INSERT INTO clinicas
            (nome_clinica, slug, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono, 
             plano_id, origem_cadastro, tipo_plano, data_expiracao, valor_atual, status_pagamento, data_cadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica, slug, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono,
                plano_id, (origem_cadastro || 'direto'), tipo_plano, data_expiracao, valor_atual, status_pagamento, data_cadastro
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 3. Criar o primeiro usuário (Dono)
        await conn.execute(
            `INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)`,
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await conn.commit();

        // 4. Disparar Notificações
        const dadosClinicaParaEnvio = {
            ...req.body,
            id: novaClinicaId,
            data_expiracao: data_expiracao.toLocaleDateString('pt-BR')
        };

        this.sendWelcomeEmail(dadosClinicaParaEnvio).catch(err => console.error("Erro email:", err));

        res.status(201).json({
            message: "Clínica criada com sucesso!",
            portalUrl: `/agendar/${slug}`
        });

    } catch (error) {
        await conn.rollback();
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro interno ao criar clínica." });
    } finally {
        conn.release();
    }
};