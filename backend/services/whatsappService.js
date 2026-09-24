// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Dispara uma mensagem de WhatsApp vinculada à clínica, validando créditos e utilizando o telefone_clinica cadastrado.
 */
exports.enviarWhatsApp = async (clinicaId, telefoneDestino, mensagem) => {
    try {
        // 1. Busca os dados da clínica (créditos disponíveis e o telefone oficial da clínica)
        const [[clinica]] = await db.query(
            'SELECT whatsapp_creditos, nome_clinica, telefone_clinica FROM clinicas WHERE id = ?',
            [clinicaId]
        );

        if (!clinica) {
            throw new Error('Clínica não encontrada.');
        }

        if (clinica.whatsapp_creditos <= 0) {
            console.warn(`[WHATSAPP] Clínica ID ${clinicaId} (${clinica.nome_clinica}) tentou enviar mensagem, mas está sem créditos.`);
            throw new Error('Créditos de WhatsApp esgotados. Faça uma recarga para continuar.');
        }

        // 2. Formata o telefone do destinatário (paciente)
        const numeroDestinoLimpo = telefoneDestino.replace(/\D/g, '');
        const destinoFormatado = numeroDestinoLimpo.startsWith('55') ? numeroDestinoLimpo : `55${numeroDestinoLimpo}`;

        // 3. Obtém o número remetente da clínica cadastrado no banco (telefone_clinica)
        const remetenteClinica = clinica.telefone_clinica ? clinica.telefone_clinica.replace(/\D/g, '') : '';

        console.log(`[WHATSAPP] Preparando disparo pela clínica: ${clinica.nome_clinica} (Remetente: ${remetenteClinica || 'Não informado'})`);
        console.log(`[WHATSAPP] Destinatário: ${destinoFormatado}`);
        console.log(`[WHATSAPP] Mensagem: "${mensagem}"`);

        // =========================================================================
        // 4. ENVIO REAL OU SIMULAÇÃO CONTROLADA
        // Se você já tiver configurado a API oficial da Brevo, substitua o bloco abaixo.
        // Enquanto testa, mantemos a integração pronta para conectar na API ou simular.
        // =========================================================================

        if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
            // Exemplo de chamada real para a API caso utilize a Brevo ou gateway compatível
            const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': process.env.BREVO_API_KEY
                },
                body: JSON.stringify({
                    senderNumber: remetenteClinica, // Usa o número específico da clínica do banco
                    contactNumber: destinoFormatado,
                    text: mensagem
                })
            });

            if (!response.ok) {
                const erroData = await response.json();
                throw new Error(erroData.message || 'Erro ao enviar WhatsApp via API');
            }
        } else {
            // Modo de desenvolvimento/validação: Loga no console simulando o envio real com sucesso
            console.log(`[WHATSAPP SIMULAÇÃO] Mensagem enviada com sucesso usando o número da clínica (${remetenteClinica})!`);
        }

        // 5. Abate 1 crédito do saldo da clínica no banco de dados
        await db.query('UPDATE clinicas SET whatsapp_creditos = whatsapp_creditos - 1 WHERE id = ?', [clinicaId]);

        console.log(`[WHATSAPP] Crédito descontado com sucesso. Saldo atualizado para a clínica ID ${clinicaId}.`);
        return true;
    } catch (err) {
        console.error('[WHATSAPP] Erro no envio:', err.message);
        throw err;
    }
};