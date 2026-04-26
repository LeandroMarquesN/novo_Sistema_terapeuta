// Importe seu serviço de notificações (ajuste o caminho conforme sua estrutura)
const notificacaoService = require('../services/notificationService');


// Rota de Registro de Nova Clínica

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

