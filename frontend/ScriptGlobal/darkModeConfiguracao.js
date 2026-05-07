const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

// Verifica se já existe uma preferência salva
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark-mode');
}

// Função para alternar o tema
function toggleDarkMode() {
  body.classList.toggle('dark-mode');

  if (body.classList.contains('dark-mode')) {
    localStorage.setItem('theme', 'dark');
  } else {
    localStorage.setItem('theme', 'light');
  }
}

// Caso você tenha um botão de toggle na tela, ele chamaria essa função
if (darkModeToggle) {
  darkModeToggle.addEventListener('click', toggleDarkMode);
}