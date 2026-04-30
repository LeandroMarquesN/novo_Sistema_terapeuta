// Importe seu serviço de notificações (ajuste o caminho conforme sua estrutura)
const notificacaoService = require('../services/notificationService');


const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

// ============================================================
// 1. SUA FUNÇÃO DE E-MAIL (Onde você coloca o seu template)
// ============================================================
// ===========================================
// FUNCAO PARA DAR BOAS VINDAS A NOVA CLINICA
// ===========================================
exports.sendWelcomeEmail = async (clinica) => {
    console.log(`[MED-LM] 📩 Iniciando processo de e-mail para: ${clinica.email_master}`);

    try {
        // 1. Definição do Assunto (Faltava isso no seu código!)
        const assunto = 'Bem-vindo ao MedLM - Sua Clínica está Ativa!';

        // 2. Caminho do Template (Ajustado para a estrutura do Docker)
        const templatePath = path.join(__dirname, '..', 'templates', 'boas_vindas.html');
        console.log(`[MED-LM] 📂 Buscando template em: ${templatePath}`);

        // 3. Lendo o arquivo
        const htmlTemplateOriginal = await fs.readFile(templatePath, 'utf-8');

        // 4. Preparando os dados
        const templateData = {
            dono_nome: clinica.dono_nome,
            nome_clinica: clinica.nome_clinica,
            email: clinica.email_master,
            senha: clinica.senha_master,
            telefone_clinica: clinica.telefone_clinica,
            telefone_dono: clinica.telefone_dono,
            ano_atual: new Date().getFullYear()
        };

        // 5. Substituindo Placeholders
        const htmlFinal = replacePlaceholders(htmlTemplateOriginal, templateData);

        // 6. Configuração do Envio
        const mailOptions = {
            from: `"MedLM - Sistema Inteligente" <${process.env.EMAIL_USER}>`,
            to: clinica.email_master,
            subject: assunto, // Aqui estava o erro (estava 'subject' sem definição)
            html: htmlFinal
        };

        console.log("[MED-LM] 🚀 Enviando e-mail via Nodemailer...");
        const info = await transporter.sendMail(mailOptions);

        console.log(`[MED-LM] ✅ SUCESSO: E-mail enviado! ID: ${info.messageId}`);

    } catch (error) {
        console.error("[MED-LM] ❌ ERRO NO ENVIO:");
        console.error("Mensagem:", error.message);

        if (error.code === 'ENOENT') {
            console.error("Causa: O arquivo 'boas_vindas.html' não foi encontrado na pasta templates.");
        } else if (error.message.includes('auth')) {
            console.error("Causa: Problema de autenticação com o Gmail. Verifique EMAIL_PASS.");
        }
    }
};

// ============================================================
// 2. A FUNÇÃO DE REGISTRO
// ============================================================
exports.registerClinica = async (req, res) => {
    const {
        nome_clinica,
        dono_nome,
        email_master,
        senha_master,
        telefone_clinica,
        telefone_dono,
        plano_id // Agora recebemos o ID do plano (1, 2 ou 3) vindo do HTML
    } = req.body;

    // Inicia uma transação para garantir que só crie a clínica se o usuário também for criado
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // 1. Lógica de Datas
        const data_cadastro = new Date();
        const data_expiracao = new Date();
        data_expiracao.setMonth(data_expiracao.getMonth() + 1); // +30 dias para o primeiro vencimento

        // 2. Inserir a Clínica (usando a nova estrutura)
        const [resultClinica] = await conn.execute(
            `INSERT INTO clinicas
            (nome_clinica, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono, plano_id, data_expiracao, valor_atual, data_cadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica,
                dono_nome,
                email_master,
                senha_master, // Texto puro por enquanto, como você pediu
                telefone_clinica,
                telefone_dono,
                plano_id,
                data_expiracao,
                69.90, // Valor promocional inicial
                data_cadastro
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 3. Criar o primeiro usuário (O Dono/Master) - ESSENCIAL PARA MULTITENANCY
        await conn.execute(
            `INSERT INTO usuarios (clinica_id, nome, email, senha, cargo)
             VALUES (?, ?, ?, ?, ?)`,
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        // Se chegou até aqui sem erros, confirma as inserções no banco
        await conn.commit();

        // 4. Disparar Notificações (E-mail/WhatsApp) em segundo plano
        // Passamos o objeto clinica completo para o seu serviço de e-mail usar o template
        const dadosClinicaParaEnvio = {
            ...req.body,
            id: novaClinicaId,
            data_expiracao: data_expiracao.toLocaleDateString('pt-BR')
        };

        // Chamada da sua função de e-mail (que você já tem)
        // Usamos o 'this' ou importamos a função específica
        this.sendWelcomeEmail(dadosClinicaParaEnvio).catch(err => console.error("Erro envio email:", err));

        // 5. Resposta de Sucesso (Isso vai disparar o seu Modal no HTML)
        res.status(201).json({
            message: "Clínica e usuário master criados com sucesso!",
            clinicaId: novaClinicaId
        });

    } catch (error) {
        // Se der qualquer erro (ex: e-mail duplicado), desfaz tudo no banco
        await conn.rollback();
        console.error("Erro no Registro de Clínica:", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Este e-mail já está cadastrado em nosso sistema." });
        }

        res.status(500).json({ error: "Erro interno ao criar clínica." });
    } finally {
        conn.release();
    }
};



