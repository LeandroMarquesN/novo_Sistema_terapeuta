// services/whatsappAgendaService.js
const whatsappService = require('./whatsappService');

/**
 * Envia mensagens padronizadas de acordo com o evento da agenda
 */
exports.notificarAgendamentoWhatsApp = async (clinica, paciente, agendamento, tipoEvento) => {
    try {
        if (!paciente || !paciente.telefone) {
            console.log('[WHATSAPP AGENDA] Paciente sem telefone cadastrado. Ignorando disparo.');
            return;
        }

        let mensagem = '';
        const nomePaciente = paciente.nome || 'Paciente';
        const nomeClinica = clinica.nome_clinica || 'nossa clínica';
        const dataFormatada = new Date(agendamento.data_agendamento).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        });

        switch (tipoEvento) {
            case 'criado':
                mensagem = `Olá ${nomePaciente}, seu agendamento na *${nomeClinica}* foi confirmado para o dia *${dataFormatada}*. Esperamos você!`;
                break;
            case 'reagendado':
                mensagem = `Olá ${nomePaciente}, o seu horário na *${nomeClinica}* foi alterado para o dia *${dataFormatada}*. Qualquer dúvida, estamos à disposição.`;
                break;
            case 'cancelado':
                mensagem = `Olá ${nomePaciente}, informamos que seu agendamento na *${nomeClinica}* para o dia *${dataFormatada}* foi cancelado. Entre em contato para remarcar.`;
                break;
            case 'lembrete_dia':
                mensagem = `Olá ${nomePaciente}, passando para lembrar da sua consulta hoje na *${nomeClinica}* às *${dataFormatada}*. Até logo!`;
                break;
            default:
                mensagem = `Olá ${nomePaciente}, mensagem importante da *${nomeClinica}* referente ao seu horário em *${dataFormatada}*.`;
        }

        // Dispara utilizando o serviço que desconta os créditos da clínica correta
        await whatsappService.enviarWhatsApp(clinica.id, paciente.telefone, mensagem);
        console.log(`[WHATSAPP AGENDA] Notificação de '${tipoEvento}' enviada para o paciente ${nomePaciente}.`);
    } catch (err) {
        console.error(`[WHATSAPP AGENDA] Erro ao enviar notificação de agenda (${tipoEvento}):`, err.message);
    }
};