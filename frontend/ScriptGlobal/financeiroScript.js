// ScriptGlobal/financeiroScript.js

// --- ESTADO GLOBAL DO SISTEMA ---
let lancamentos = [];
let meuGrafico = null;
let itemParaBaixar = null;
let metodoSelecionado = '';

/**
 * 1. COMUNICAÇÃO COM O BACKEND (apiFetch)
 * Centraliza o Token e o tratamento de erros 403 (Segurança)
 */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const defaultOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };

  try {
    const response = await fetch(endpoint, defaultOptions);

    // Interceptor de Segurança: Se o cargo não permitir acesso (Regra do Dono/Admin)
    if (response.status === 403) {
      const erroData = await response.json();
      exibirModalNegado(erroData.error); // Dispara o modal Glassmorphism
      return null;
    }

    // Se o token estiver vencido ou inválido
    if (response.status === 401) {
      window.location.href = '/login.html';
      return null;
    }

    if (!response.ok) throw new Error('Erro na requisição');
    return await response.json();

  } catch (error) {
    console.error("Erro na API:", error);
    return null;
  }
}

/**
 * 2. CARREGAR DADOS ESTRATÉGICOS
 * Chamada principal que alimenta a tabela e os cards de poder
 */
async function carregarDadosEstrategicos() {
  // 1. Busca os lançamentos para a tabela
  const dados = await apiFetch('/api/financeiro/lista');
  if (dados) {
    lancamentos = dados;
    renderizar();
  }

  // 2. Busca o resumo básico (Faturamento, Saldo)
  const resumoBasico = await apiFetch('/api/financeiro/resumo');

  // 3. Busca os dados ESTRATÉGICOS (CAC, LTV, Conversão, Lucro Real)
  const resumoAvancado = await apiFetch('/api/financeiro/resumo-estrategico');

  if (resumoBasico && resumoAvancado) {
    // Juntamos os dois objetos em um só chamado 'resumoCompleto'
    const resumoCompleto = Object.assign({}, resumoBasico, resumoAvancado);

    // Agora passamos o objeto completo para a função que desenha os cards
    atualizarCards(resumoCompleto);
  }
}

/**
 * 3. RENDERIZAR TABELA (Com lógica de Inadimplência)
 */
function renderizar(dadosParaExibir = lancamentos) {
  const tbody = document.getElementById('listaFinanceira');
  if (!tbody) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  tbody.innerHTML = dadosParaExibir.map(item => {
    const dataVencimento = new Date(item.data_vencimento);
    const isInadimplente = dataVencimento < hoje && item.status_pagamento === 'aberto';
    const isCancelado = item.status_pagamento === 'cancelado'; // Nova verificação

    // Define a cor da data e do status
    let classeData = 'text-gray-400';
    if (isInadimplente) classeData = 'text-red-600 font-bold';
    if (isCancelado) classeData = 'text-orange-500 font-medium';

    return `
          <tr class="hover:bg-gray-50 transition ${isInadimplente ? 'bg-red-50/30' : ''} ${isCancelado ? 'opacity-60 bg-gray-50' : ''}">
              <td class="px-8 py-6 text-sm font-medium ${classeData}">
                  ${dataVencimento.toLocaleDateString('pt-BR')}
                  ${isInadimplente ? '<br><span class="text-[10px] uppercase">Vencido</span>' : ''}
                  ${isCancelado ? '<br><span class="text-[10px] uppercase font-black text-orange-600">Cancelado</span>' : ''}
              </td>
              <td class="px-8 py-6">
                  <div class="flex flex-col">
                      <span class="text-sm font-bold text-gray-900">${item.paciente_nome}</span>
                      <a href="https://wa.me/55${item.paciente_tel}" target="_blank" class="text-[10px] text-emerald-500 font-bold hover:underline">
                          <i class="fab fa-whatsapp"></i> Contato Direto
                      </a>
                  </div>
              </td>

              <td class="px-8 py-6 text-xs text-gray-500 font-medium">Sinal de Consulta</td>
              <td class="px-8 py-6 text-center">
                  <button onclick="irParaReagendamento(${item.paciente_id}, '${item.paciente_nome}', '${item.paciente_cpf || ''}', '${item.paciente_email || ''}', '${item.paciente_tel || ''}')"
                          class="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition border border-indigo-100">
                      <i class="fas fa-calendar-plus"></i> Novo Horário
                  </button>
              </td>

              <td class="px-8 py-6 text-right">
                  <span class="text-sm font-black ${item.status_pagamento === 'pago' ? 'text-emerald-500' : (isCancelado || isInadimplente ? 'text-red-600' : 'text-gray-900')}">
                      R$ ${parseFloat(item.valor).toFixed(2)}
                  </span>
              </td>


              <td class="px-8 py-6 text-center">
                  <div class="flex justify-center gap-2">
                      ${item.status_pagamento === 'aberto' ? `
                          <button onclick="abrirModal(${item.id})" class="w-8 h-8 rounded-full ${isInadimplente ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'} hover:bg-emerald-500 hover:text-white transition shadow-sm" title="Baixar Pagamento">
                              <i class="fas fa-check text-[10px]"></i>
                          </button>
                          <button onclick="cancelarLancamento(${item.id})" class="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition shadow-sm" title="Paciente Desistiu/Cancelou">
                              <i class="fas fa-user-slash text-[10px]"></i>
                          </button>
                      ` : (isCancelado ? '<span class="text-orange-600 text-[10px] font-bold uppercase">Sem Visita</span>' : '<i class="fas fa-check-double text-emerald-500" title="Pago"></i>')}

                      <button class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition shadow-sm">
                          <i class="fas fa-file-pdf text-[10px]"></i>
                      </button>
                  </div>
              </td>
          </tr>
      `;
  }).join('');
}

function irParaReagendamento(id, nome, cpf, email, tel) {
  const params = new URLSearchParams();
  params.append('reagendamento', 'true');
  params.append('paciente_id', id);
  params.append('nome', nome);
  if (cpf) params.append('cpf', cpf);
  if (email) params.append('email', email);
  if (tel) params.append('telefone', tel);

  window.location.href = `/agendamento?${params.toString()}`;
}

// 1. FUNÇÃO DE AÇÃO (Fica isolada)
async function cancelarLancamento(id) {
  if (!confirm("Confirmar cancelamento? O status mudará para 'cancelado' no banco.")) return;

  const resultado = await apiFetch(`/api/financeiro/cancelar/${id}`, {
    method: 'POST'
  });

  if (resultado) {
    // ESSA LINHA AQUI é o que faz a mágica:
    // Ela busca os novos dados e CHAMA a atualizarCards automaticamente
    await carregarDadosEstrategicos();
    alert("Agendamento cancelado!");
  }
}

/**
 * 4. ATUALIZAR CARDS DE PODER E GRÁFICO
 */
function atualizarCards(resumo) {
  if (!resumo) return;

  // Dentro da função atualizarCards(resumo)
  const elementosKPI = {
    lucro: document.getElementById('lucroReal'),
    cac: document.getElementById('valorCAC'),
    ltv: document.getElementById('valorLTV'),
    conversao: document.getElementById('taxaConversao')
  };

  // Atualiza os textos dos Cards (Adicionado o totalDevedores)
  const elementos = {
    saldo: document.getElementById('saldoPendente'),
    faturamento: document.getElementById('faturamentoMes'),
    inadimplencia: document.getElementById('totalDevedores'), // O card vermelho
    ticket: document.getElementById('ticketMedio'), // <-- NOVO
    textoSaude: document.getElementById('textoSaude'),
    barra: document.getElementById('barraProgressoSaude')
  };
  // exibe novos cards de fedd back
  // Dentro de atualizarCards(resumo)

  // O Lucro Real na nossa query do backend se chama 'lucro_real'
  if (elementosKPI.lucro) {
    elementosKPI.lucro.innerText = `R$ ${parseFloat(resumo.lucro_real || 0).toFixed(2)}`;
  }

  if (elementosKPI.cac) {
    elementosKPI.cac.innerText = `R$ ${parseFloat(resumo.cac || 0).toFixed(2)}`;
  }

  // O LTV na query se chama 'ltv_medio'
  if (elementosKPI.ltv) {
    elementosKPI.ltv.innerText = `R$ ${parseFloat(resumo.ltv_medio || 0).toFixed(2)}`;
  }

  if (elementosKPI.conversao) {
    elementosKPI.conversao.innerText = `${Math.round(resumo.taxa_conversao || 0)}%`;
  }

  // Exibe o Ticket Médio formatado
  if (elementos.ticket) {
    elementos.ticket.innerText = `R$ ${parseFloat(resumo.ticket_medio || 0).toFixed(2)}`;
  }

  // Atualiza o valor monetário dos cards
  if (elementos.saldo) elementos.saldo.innerText = `R$ ${parseFloat(resumo.saldo_receber || 0).toFixed(2)}`;
  if (elementos.faturamento) elementos.faturamento.innerText = `R$ ${parseFloat(resumo.faturamento_mes || 0).toFixed(2)}`;

  // ATUALIZAÇÃO DO CARD DE CANCELADOS/ATRASADOS
  // O backend deve enviar a soma de (vencidos + cancelados) neste campo
  if (elementos.inadimplencia) {
    elementos.inadimplencia.innerText = resumo.quantidade_inadimplentes || 0;
  }

  // Cálculo da Saúde Financeira
  const total = parseFloat(resumo.faturamento_mes || 0) + parseFloat(resumo.saldo_receber || 0);
  const perc = total > 0 ? (resumo.faturamento_mes / total) * 100 : 0;

  if (elementos.textoSaude) elementos.textoSaude.innerText = `${Math.round(perc)}%`;
  if (elementos.barra) elementos.barra.style.width = `${perc}%`;

  // Atualiza o Gráfico Dinamicamente
  if (meuGrafico) {
    meuGrafico.data.datasets[0].data = [resumo.saldo_receber, resumo.faturamento_mes];
    meuGrafico.update();
  }
}

/**
 * 5. LÓGICA DO MODAL DE PAGAMENTO (BAIXA)
 */
function abrirModal(id) {
  const item = lancamentos.find(l => l.id === id);
  if (!item) return;

  itemParaBaixar = item;
  metodoSelecionado = '';

  document.getElementById('modalNomePaciente').innerText = item.paciente_nome;
  document.getElementById('modalValor').innerText = `R$ ${parseFloat(item.valor).toFixed(2)}`;

  // Limpa seleções de botões
  document.querySelectorAll('.metodo-btn').forEach(btn => btn.className = 'metodo-btn flex flex-col items-center p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition cursor-pointer');

  const modal = document.getElementById('modalPagamento');
  if (modal) modal.classList.remove('hidden');
}

function selecionarMetodo(metodo, elemento) {
  metodoSelecionado = metodo;
  document.querySelectorAll('.metodo-btn').forEach(btn => btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'border-blue-500', 'bg-blue-50', 'border-amber-500', 'bg-amber-50'));

  if (metodo === 'pix') elemento.classList.add('border-emerald-500', 'bg-emerald-50');
  if (metodo === 'cartao') elemento.classList.add('border-blue-500', 'bg-blue-50');
  if (metodo === 'dinheiro') elemento.classList.add('border-amber-500', 'bg-amber-50');
}

async function processarBaixa() {
  if (!metodoSelecionado) return alert("Por favor, selecione a forma de pagamento.");

  const resultado = await apiFetch(`/api/financeiro/baixar/${itemParaBaixar.id}`, {
    method: 'POST',
    body: JSON.stringify({ metodo_pagamento: metodoSelecionado })
  });

  if (resultado) {
    fecharModal();
    carregarDadosEstrategicos(); // Recarrega tudo para atualizar Cards e Gráfico
    alert("Pagamento registrado com sucesso!");
  }
}

function fecharModal() {
  const modal = document.getElementById('modalPagamento');
  if (modal) modal.classList.add('hidden');
  itemParaBaixar = null;
  metodoSelecionado = '';
}

/**
 * 6. AUXILIARES E FILTROS
 */
function exibirModalNegado(mensagem) {
  const modal = document.getElementById('modal-negado');
  const msgElemento = document.getElementById('mensagem-erro-modal');
  if (modal) {
    msgElemento.innerText = mensagem;
    modal.style.display = 'flex';
  }
}

function voltarParaSeguranca() {
  window.location.href = '/';
}

function filtrarPeriodo(periodo) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let filtrados = lancamentos;

  if (periodo === 'hoje') {
    filtrados = lancamentos.filter(i => new Date(i.data_vencimento).setHours(0, 0, 0, 0) === hoje.getTime());
  } else if (periodo === 'semana') {
    const seteDias = new Date(); seteDias.setDate(hoje.getDate() - 7);
    filtrados = lancamentos.filter(i => new Date(i.data_vencimento) >= seteDias);
  }
  renderizar(filtrados);
}
