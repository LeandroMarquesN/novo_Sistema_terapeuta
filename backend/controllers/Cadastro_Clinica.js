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

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // 1. Buscar valores do plano escolhido
        const [planos] = await conn.execute('SELECT valor_base, valor_promocional FROM planos WHERE id = ?', [plano_id]);
        if (planos.length === 0) throw new Error("Plano não encontrado");
        const plano = planos[0];

        // 2. Verificar se é Fundador
        const [fundadorCheck] = await conn.execute(
            'SELECT id FROM lista_espera WHERE email = ?',
            [email_master.toLowerCase()]
        );
        const isFundador = fundadorCheck.length > 0;

        // 3. Cálculo das datas
        const hoje = new Date();
        let data_fim_gratuidade = new Date();

        if (isFundador) {
            data_fim_gratuidade.setDate(hoje.getDate() + 90);
        } else {
            // Se não é fundador, gratuidade acaba hoje (o trial vira promocional direto)
            data_fim_gratuidade = new Date(hoje);
        }

        let data_fim_promocao = new Date(data_fim_gratuidade);
        data_fim_promocao.setDate(data_fim_promocao.getDate() + 60);

        // 4. Definição do valor inicial
        // Se isFundador, começa com 0 (grátis). Se não, começa com o valor_promocional do plano.
        const valor_inicial = isFundador ? 0 : plano.valor_promocional;

        // 5. Inserção
        const [resultClinica] = await conn.execute(
            `INSERT INTO clinicas
            (nome_clinica, slug, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono, 
             plano_id, origem_cadastro, tipo_plano, data_cadastro, data_expiracao, 
             data_fim_gratuidade, data_fim_promocao, valor_atual, status_pagamento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica, gerarSlug(nome_clinica), dono_nome, email_master, senha_master,
                telefone_clinica, telefone_dono, plano_id,
                (origem_cadastro || 'DIRETO'),
                (isFundador ? 'FUNDADOR' : 'PADRAO'),
                hoje.toISOString().split('T')[0],
                data_fim_gratuidade.toISOString().split('T')[0],
                data_fim_gratuidade.toISOString().split('T')[0],
                data_fim_promocao.toISOString().split('T')[0],
                valor_inicial, // Valor dinâmico conforme o plano e perfil
                'trial'
            ]
        );

        // ... resto da criação do usuário e commit
        const novaClinicaId = resultClinica.insertId;
        await conn.execute(
            `INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)`,
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await conn.commit();
        res.status(201).json({ message: "Clínica criada!", portalUrl: `/agendar/${gerarSlug(nome_clinica)}` });

    } catch (error) {
        await conn.rollback();
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro interno." });
    } finally {
        conn.release();
    }
};