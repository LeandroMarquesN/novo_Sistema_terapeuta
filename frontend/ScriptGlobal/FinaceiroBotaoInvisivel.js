// Script para visualizar o botao do menu financeiro somente para quem tem o cargo de dono ou admin ou administrador

document.addEventListener('DOMContentLoaded', () => {
  const cargo = localStorage.getItem('usuarioCargo'); // O campo que você salvou no login
  const btnFinanceiro = document.getElementById('nav-financeiro');

  const cargosAutorizados = ['dono', 'admin', 'administrador'];

  if (btnFinanceiro && !cargosAutorizados.includes(cargo)) {
    btnFinanceiro.style.display = 'none'; // Esconde o botão se não for chefe
  }
});