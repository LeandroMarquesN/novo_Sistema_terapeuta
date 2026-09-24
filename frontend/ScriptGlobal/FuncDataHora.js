// ======  Função data e hora
// ======  Função data e hora
function atualizarDataHora() {
  const elemento = document.getElementById('data-hora');
  if (!elemento) return;

  const now = new Date();
  const dataHora = now.toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  elemento.textContent = dataHora;
}

atualizarDataHora();
setInterval(atualizarDataHora, 1000);