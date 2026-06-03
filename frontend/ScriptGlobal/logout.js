async function handleLogout(event) {
  if (event) event.preventDefault();

  console.log("Iniciando encerramento de sessão seguro...");

  const modal = document.getElementById('logoutModal');

  // 1. Ativa o Modal (Usando Flex para centralizar tudo)
  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
  }

  try {
    // 2. Avisa o servidor (Enviando o token antes de apagar)
    const token = localStorage.getItem('token');

    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.log("Aviso ao servidor falhou, mas o logout local prossegue.");
  } finally {
    // 3. LIMPEZA TOTAL (Segurança dos dados dos pacientes)
    localStorage.clear();
    console.log("Sessão limpa localmente.");

    // 4. Aguarda um tempo para o usuário ver o modal e redireciona
    setTimeout(() => {
      // O '/' garante que ele volte para a raiz mapeada no app.js
      // O '?t=' é o parâmetro para limpar o cache, mas agora com a sintaxe correta
      window.location.replace('/?t=' + Date.now());
    }, 2000);
  }
}