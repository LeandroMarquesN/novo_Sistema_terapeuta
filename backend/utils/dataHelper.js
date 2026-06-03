/**
 * Adiciona minutos a uma string de horário (HH:mm)
 */
exports.adicionarMinutos = (horario, minutos) => {
  let [h, m] = horario.split(':').map(Number);
  let totalMinutos = h * 60 + m + parseInt(minutos);
  let novasH = Math.floor(totalMinutos / 60);
  let novosM = totalMinutos % 60;
  return `${String(novasH).padStart(2, '0')}:${String(novosM).padStart(2, '0')}`;
};

/**
* Formata data do banco para HH:mm
*/
exports.formatarHora = (dataString) => {
  const d = new Date(dataString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};