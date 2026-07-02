const dataHelper = require('../utils/dataHelper');

exports.gerarSlotsDisponiveis = (config, agendamentosOcupados) => {
  const slots = [];

  const paraMinutos = (time) => {
    if (!time) return 0;
    const [h, m] = time.substring(0, 5).split(':').map(Number);
    return h * 60 + m;
  };

  const aberturaMin = paraMinutos(config.horario_abertura);
  const fechamentoMin = paraMinutos(config.horario_fechamento);
  const duracao = parseInt(config.duracao_atendimento) || 60; // Fallback de segurança

  // Normalizamos as ocupações para minutos desde a meia-noite
  // Isso evita qualquer erro de formato de string
  // Nova lógica mais robusta para extrair minutos ocupados
  const minutosOcupados = agendamentosOcupados.map(ag => {
    const d = new Date(ag.data_agendamento);
    // Extrai horas e minutos diretamente do objeto Date (fuso SP)
    const horas = d.getUTCHours() - 3; // Ajuste manual para -03:00 (se o servidor for UTC)
    // OU, se você preferir usar o Intl para precisão total:
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    });
    const partes = formatter.formatToParts(d);
    const h = parseInt(partes.find(p => p.type === 'hour').value);
    const m = parseInt(partes.find(p => p.type === 'minute').value);

    return h * 60 + m;
  });

  console.log("[AgendaService] Minutos ocupados:", minutosOcupados);

  for (let m = aberturaMin; m < fechamentoMin; m += duracao) {
    // Verificamos se esse slot (em minutos) está na lista de ocupados
    if (!minutosOcupados.includes(m)) {
      const horaFormatada = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      slots.push(horaFormatada);
    }
  }

  return slots;
};