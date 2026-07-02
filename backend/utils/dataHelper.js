/**
 * Adiciona minutos a uma string de horário (HH:mm)
 */
exports.adicionarMinutos = (horario, minutos) => {
  let [h, m] = horario.split(':').map(Number);
  let totalMinutos = h * 60 + m + parseInt(minutos);

  // Normaliza para dentro de 24h (0–1439), tratando também minutos negativos
  totalMinutos = ((totalMinutos % 1440) + 1440) % 1440;

  let novasH = Math.floor(totalMinutos / 60);
  let novosM = totalMinutos % 60;
  return `${String(novasH).padStart(2, '0')}:${String(novosM).padStart(2, '0')}`;
};


/**
 * Formata data do banco para HH:mm respeitando o fuso local de São Paulo
 */
exports.formatarHora = (dataString) => {
  // Criamos o objeto date. Se for uma string do banco, 
  // ele interpreta corretamente no fuso local.
  const d = new Date(dataString);

  // Garantimos que o retorno seja sempre no padrão HH:mm
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Força formato 24h
    timeZone: 'America/Sao_Paulo'
  });
};