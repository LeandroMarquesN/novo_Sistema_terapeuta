// ScriptGlobal/financeiroScript.js

let itemParaBaixar = null; // Variável global de controle
let metodoSelecionado = '';

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token'); // Verifique se é 'token' ou 'token_medlm'

  const defaultOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };

  const response = await fetch(endpoint, defaultOptions);

  if (response.status === 401 || response.status === 403) {
    window.location.href = '/login.html';
    return;
  }

  return response.json();
}

async function processarBaixa() {
  if (!metodoSelecionado) return alert("Selecione o método!");
  if (!itemParaBaixar) return alert("Erro ao identificar o lançamento.");

  try {
    const resultado = await apiFetch(`/api/financeiro/baixar/${itemParaBaixar.id}`, {
      method: 'POST',
      body: JSON.stringify({ metodo_pagamento: metodoSelecionado })
    });

    if (resultado) {
      fecharModal();
      carregarDadosEstrategicos(); // Função que recarrega os dados do banco
      alert("Baixa realizada com sucesso!");
    }
  } catch (error) {
    console.error("Erro na baixa:", error);
    alert("Erro ao processar o pagamento.");
  }
}

// ------------------funcao de filtrar periodo -------------------------------

function filtrarPeriodo(periodo) {
  // 1. Atualiza visualmente os botões
  document.querySelectorAll('.btn-periodo').forEach(btn => {
    btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
    btn.classList.add('text-gray-500');
  });
  event.currentTarget.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
  event.currentTarget.classList.remove('text-gray-500');

  // 2. Lógica de filtro real
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let dadosFiltrados = lancamentos; // 'lancamentos' é a variável que veio do banco

  if (periodo === 'hoje') {
    dadosFiltrados = lancamentos.filter(item => {
      const dataItem = new Date(item.data_vencimento);
      dataItem.setHours(0, 0, 0, 0);
      return dataItem.getTime() === hoje.getTime();
    });
  } else if (periodo === 'semana') {
    // Lógica para os últimos 7 dias
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(hoje.getDate() - 7);
    dadosFiltrados = lancamentos.filter(item => new Date(item.data_vencimento) >= umaSemanaAtras);
  }

  // 3. Renderiza a tabela com o que sobrou do filtro
  renderizar(dadosFiltrados);
}