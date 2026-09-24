// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Dispara uma mensagem de WhatsApp vinculada à clínica, validando créditos, 
 * garantindo a instância na Evolution API e utilizando o telefone_clinica cadastrado.
 */
exports.enviarWhatsApp = async (clinicaId, telefoneDestino, mensagem) => {
    try {
        // 1. Busca os dados da clínica (créditos disponíveis, nome e o telefone oficial)
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

        // 3. Obtém e valida o número remetente da clínica cadastrado no banco (telefone_clinica)
        const remetenteClinica = clinica.telefone_clinica ? clinica.telefone_clinica.replace(/\D/g, '') : '';

        if (!remetenteClinica) {
            throw new Error('A clínica não possui um telefone oficial cadastrado (telefone_clinica) para realizar o disparo.');
        }

        // Nome da instância exclusiva da clínica na Evolution API (ex: clinica_5)
        const instanceName = `clinica_${clinicaId}`;
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'https://medlm-evolution-api.onrender.com';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY; // A chave mestra configurada no Render

        console.log(`[WHATSAPP] Disparando pela clínica: ${clinica.nome_clinica} (Instância: ${instanceName})`);
        console.log(`[WHATSAPP] Destinatário: ${destinoFormatado}`);

        // 4. Envio real via Evolution API
        const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey
            },
            body: JSON.stringify({
                number: destinoFormatado,
                text: mensagem,
                delay: 1200
            })
        });

        if (!response.ok) {
            const erroData = await response.json().catch(() => ({}));
            throw new Error(erroData.message || `Erro na Evolution API: ${response.statusText}`);
        }

        // 5. Abate 1 crédito do saldo da clínica no banco de dados após o sucesso
        await db.query('UPDATE clinicas SET whatsapp_creditos = whatsapp_creditos - 1 WHERE id = ?', [clinicaId]);

        console.log(`[WHATSAPP] Mensagem enviada com sucesso e crédito descontado para a clínica ID ${clinicaId}.`);
        return true;
    } catch (err) {
        console.error('[WHATSAPP] Erro no envio:', err.message);
        throw err;
    }
};