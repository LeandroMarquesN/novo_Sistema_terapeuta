// Verifica se o usuário está logado antes mesmo de carregar o CSS
if (!localStorage.getItem('token')) {
  window.location.replace('index.html');
}