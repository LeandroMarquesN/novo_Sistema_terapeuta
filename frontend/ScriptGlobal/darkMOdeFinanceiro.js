// ================== Função Dark Mode Blindada (MedLM) ==================
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = themeToggleBtn.querySelector('i');
const themeText = document.getElementById('theme-text');

function aplicarTema(tema) {
  if (tema === 'dark') {
    // 1. Tailwind Dark Mode
    document.documentElement.classList.add('dark');
    // 2. Bootstrap Dark Mode (se houver componentes)
    document.documentElement.setAttribute('data-bs-theme', 'dark');

    // UI Changes
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    themeText.innerText = "Modo Claro";
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-bs-theme', 'light');

    themeIcon.classList.replace('fa-sun', 'fa-moon');
    themeText.innerText = "Modo Escuro";
    localStorage.setItem('theme', 'light');
  }
}

// Verifica preferência ao carregar
const temaSalvo = localStorage.getItem('theme') || 'light';
aplicarTema(temaSalvo);

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('dark');
  aplicarTema(isDark ? 'light' : 'dark');
});