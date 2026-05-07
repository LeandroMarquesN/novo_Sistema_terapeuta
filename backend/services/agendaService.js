const dataHelper = require('../utils/dataHelper');

exports.gerarSlotsDisponiveis = (config, agendamentosOcupados) => {
  const slots = [];
  let horarioAtual = config.horario_abertura; // Ex: "08:00:00"
  const horarioFechamento = config.horario_fechamento;
  const duracao = config.duracao_atendimento;

  // Extrair apenas as horas ocupadas para comparação rápida
  const horasOcupadas = agendamentosOcupados.map(ag => {
    return dataHelper.formatarHora(ag.data_agendamento);
  });

  // Enquanto o horário atual + duração não ultrapassar o fechamento
  while (horarioAtual < horarioFechamento) {
    const proximoHorario = dataHelper.adicionarMinutos(horarioAtual, duracao);

    if (proximoHorario <= horarioFechamento) {
      const horaFormatada = horarioAtual.substring(0, 5); // "08:00"

      if (!horasOcupadas.includes(horaFormatada)) {
        slots.push(horaFormatada);
      }
    }
    horarioAtual = proximoHorario;
  }

  return slots;
};