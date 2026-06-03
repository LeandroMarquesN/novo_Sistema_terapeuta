window.addEventListener('pageshow', function (event) {
  // Se a página for carregada do cache (botão voltar)
  if (event.persisted || (typeof window.performance != "undefined" && window.performance.navigation.type === 2)) {
    // Se não tiver token, manda pro login na hora
    if (!localStorage.getItem('token')) {
      window.location.replace('login.html');
    } else {
      // Se tiver token, recarrega para garantir dados frescos
      window.location.reload();
    }
  }
});