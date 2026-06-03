// ==================  Função dark mode ===============
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = themeToggleBtn.querySelector('i');

// 1. Função para aplicar o tema
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-bs-theme', tema);
  localStorage.setItem('theme', tema); // Salva a preferência

  // Troca o ícone (Lua para Sol e vice-versa)
  if (tema === 'dark') {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    themeToggleBtn.classList.replace('btn-outline-dark', 'btn-outline-light');
  } else {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    themeToggleBtn.classList.replace('btn-outline-light', 'btn-outline-dark');
  }
}

// 2. Verifica se o usuário já tinha uma preferência salva
const temaSalvo = localStorage.getItem('theme') || 'light';
aplicarTema(temaSalvo);

// 3. Ouvinte de clique no botão
themeToggleBtn.addEventListener('click', () => {
  const temaAtual = document.documentElement.getAttribute('data-bs-theme');
  const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
  aplicarTema(novoTema);
});