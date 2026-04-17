// ======  Função data e hora
function atualizarDataHora() {
  const now = new Date();
  const dataHora = now.toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  document.getElementById('data-hora').textContent = dataHora;
}
atualizarDataHora();
setInterval(atualizarDataHora, 1000);