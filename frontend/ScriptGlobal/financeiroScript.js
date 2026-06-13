// ScriptGlobal/financeiroScript.js

// --- ESTADO GLOBAL DO SISTEMA ---
let lancamentos = [];
let meuGrafico = null;
let itemParaBaixar = null; // Usado para a tabela principal
let metodoSelecionado = 'pix'; // Padrão inicial unificado

// Variáveis de controle específicas para a gaveta de extrato
let lancamentoIdParaBaixaExtrato = null;
let pacienteIdParaBaixaExtrato = null;

/**
 * 1. COMUNICAÇÃO COM O BACKEND (apiFetch)
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

    if (response.status === 403) {
      const erroData = await response.json();
      exibirModalNegado(erroData.error);
      return null;
    }

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
 */
async function carregarDadosEstrategicos() {
  const dados = await apiFetch('/api/financeiro/lista');
  if (dados) {
    lancamentos = dados;
    renderizar();
  }

  const resumoBasico = await apiFetch('/api/financeiro/resumo');
  const resumoAvancado = await apiFetch('/api/financeiro/resumo-estrategico');

  if (resumoBasico && resumoAvancado) {
    const resumoCompleto = Object.assign({}, resumoBasico, resumoAvancado);
    atualizarCards(resumoCompleto);
  }
}

/**
 * 3. RENDERIZAR TABELA PRINCIPAL
 */
function renderizar(dadosParaExibir = lancamentos) {
  const tbody = document.getElementById('listaFinanceira');
  if (!tbody) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  tbody.innerHTML = dadosParaExibir.map(item => {
    const dataVencimento = item.data_vencimento.includes('T')
      ? new Date(item.data_vencimento)
      : new Date(item.data_vencimento + 'T00:00:00');

    const dataVencimentoZerada = new Date(dataVencimento);
    dataVencimentoZerada.setHours(0, 0, 0, 0);

    const isInadimplente = dataVencimentoZerada < hoje && item.status_pagamento === 'aberto';
    const isCancelado = item.status_pagamento === 'cancelado';

    let classeData = 'text-gray-400';
    if (isInadimplente) classeData = 'text-red-600 font-bold';
    if (isCancelado) classeData = 'text-orange-500 font-medium';

    const telefoneLimpo = item.paciente_tel ? String(item.paciente_tel).replace(/\D/g, '') : '';

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
                      ${telefoneLimpo ? `
                        <a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="text-[10px] text-emerald-500 font-bold hover:underline">
                            <i class="fab fa-whatsapp"></i> Contato Direto
                        </a>
                      ` : '<span class="text-[10px] text-gray-400">Sem telefone</span>'}
                  </div>
              </td>

              <td class="px-8 py-6">
                  <div class="flex flex-col">
                      <span class="text-xs text-gray-700 font-bold">${item.descricao || 'Sinal de Consulta'}</span>
                      ${item.categoria ? `<span class="text-[9px] text-indigo-500 uppercase font-black tracking-wider mt-0.5">${item.categoria}</span>` : ''}
                  </div>
              </td>
              <td class="px-8 py-6 text-center">
                  <button onclick="irParaReagendamento(${item.paciente_id}, '${item.paciente_nome}', '${item.paciente_cpf || ''}', '${item.paciente_email || ''}', '${item.paciente_tel || ''}')"
                          class="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition border border-indigo-100">
                      <i class="fas fa-calendar-plus"></i> Novo Horário
                  </button>
              </td>

              <td class="px-8 py-6 text-right">
                  <span class="text-sm font-black ${item.status_pagamento === 'pago' ? 'text-emerald-500' : (isCancelado || isInadimplente ? 'text-red-600' : 'text-gray-900')}">
                      R$ ${parseFloat(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                      <button onclick="abrirExtratoPaciente(${item.paciente_id}, '${item.paciente_nome}')"
                            class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition shadow-sm"
                            title="Ver Extrato de Gastos">
                        <i class="fas fa-file-invoice-dollar text-[11px]"></i>
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

async function cancelarLancamento(id) {
  if (!confirm("Confirmar cancelamento? O status mudará para 'cancelado' no banco.")) return;

  const resultado = await apiFetch(`/api/financeiro/cancelar/${id}`, {
    method: 'POST'
  });

  if (resultado) {
    await carregarDadosEstrategicos();
    alert("Agendamento cancelado!");
  }
}

/**
 * 4. ATUALIZAR CARDS DE PODER E GRÁFICO
 */
function atualizarCards(resumo) {
  if (!resumo) return;

  const elementosKPI = {
    lucro: document.getElementById('lucroReal'),
    cac: document.getElementById('valorCAC'),
    ltv: document.getElementById('valorLTV'),
    conversao: document.getElementById('taxaConversao')
  };

  const elementos = {
    saldo: document.getElementById('saldoPendente'),
    faturamento: document.getElementById('faturamentoMes'),
    inadimplencia: document.getElementById('totalDevedores'),
    ticket: document.getElementById('ticketMedio'),
    textoSaude: document.getElementById('textoSaude'),
    barra: document.getElementById('barraProgressoSaude')
  };

  if (elementosKPI.lucro) elementosKPI.lucro.innerText = `R$ ${parseFloat(resumo.lucro_real || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (elementosKPI.cac) elementosKPI.cac.innerText = `R$ ${parseFloat(resumo.cac || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (elementosKPI.ltv) elementosKPI.ltv.innerText = `R$ ${parseFloat(resumo.ltv_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (elementosKPI.conversao) elementosKPI.conversao.innerText = `${Math.round(resumo.taxa_conversao || 0)}%`;
  if (elementos.ticket) elementos.ticket.innerText = `R$ ${parseFloat(resumo.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (elementos.saldo) elementos.saldo.innerText = `R$ ${parseFloat(resumo.saldo_receber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (elementos.faturamento) elementos.faturamento.innerText = `R$ ${parseFloat(resumo.faturamento_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (elementos.inadimplencia) elementos.inadimplencia.innerText = resumo.quantidade_inadimplentes || 0;

  const total = parseFloat(resumo.faturamento_mes || 0) + parseFloat(resumo.saldo_receber || 0);
  const perc = total > 0 ? (resumo.faturamento_mes / total) * 100 : 0;

  if (elementos.textoSaude) elementos.textoSaude.innerText = `${Math.round(perc)}%`;
  if (elementos.barra) elementos.barra.style.width = `${perc}%`;

  if (meuGrafico) {
    meuGrafico.data.datasets[0].data = [resumo.saldo_receber, resumo.faturamento_mes];
    meuGrafico.update();
  }
}

/**
 * 5. CONTROLADORES UNIFICADOS DO MODAL DE PAGAMENTO
 */
function abrirModal(id) {
  const item = lancamentos.find(l => l.id === id);
  if (!item) return;

  itemParaBaixar = item;
  lancamentoIdParaBaixaExtrato = null; // Reseta o controle do extrato
  metodoSelecionado = 'pix';

  document.getElementById('modalNomePaciente').innerText = item.paciente_nome;
  document.getElementById('modalValor').innerText = `R$ ${parseFloat(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  resetarBotoesMetodo();

  const modal = document.getElementById('modalPagamento');
  if (modal) modal.classList.remove('hidden');
}

// 🆕 Função chamada pelo clique do Extrato (Gaveta)
function baixarLancamentoAvulso(id, pacienteId, nomePaciente, valorFormatado) {
  lancamentoIdParaBaixaExtrato = id;
  pacienteIdParaBaixaExtrato = pacienteId;
  itemParaBaixar = null; // Reseta o controle da tabela principal
  metodoSelecionado = 'pix';

  document.getElementById('modalNomePaciente').innerText = nomePaciente;
  document.getElementById('modalValor').innerText = valorFormatado;

  resetarBotoesMetodo();

  const modal = document.getElementById('modalPagamento');
  if (modal) modal.classList.remove('hidden');
}

function resetarBotoesMetodo() {
  document.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'border-blue-500', 'bg-blue-50', 'border-amber-500', 'bg-amber-50');
    btn.classList.add('border-gray-100');
  });
  // Ativa visualmente o PIX por padrão
  const btnPix = document.querySelector("button[onclick*='pix']");
  if (btnPix) btnPix.classList.add('border-emerald-500', 'bg-emerald-50');
}

function selecionarMetodo(metodo, elemento) {
  metodoSelecionado = metodo;
  document.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'border-blue-500', 'bg-blue-50', 'border-amber-500', 'bg-amber-50');
    btn.classList.add('border-gray-100');
  });

  elemento.classList.remove('border-gray-100');
  if (metodo === 'pix') elemento.classList.add('border-emerald-500', 'bg-emerald-50');
  if (metodo === 'cartao') elemento.classList.add('border-blue-500', 'bg-blue-50');
  if (metodo === 'dinheiro') elemento.classList.add('border-amber-500', 'bg-amber-50');
}

function fecharModal() {
  const modal = document.getElementById('modalPagamento');
  if (modal) modal.classList.add('hidden');
  itemParaBaixar = null;
  lancamentoIdParaBaixaExtrato = null;
  pacienteIdParaBaixaExtrato = null;
  metodoSelecionado = 'pix';
}

// 💥 PROCESSAR BAIXA INTELIGENTE (Determina a rota dinâmica e ações pós-sucesso)
async function processarBaixa() {
  if (!metodoSelecionado) return alert("Por favor, selecione a forma de pagamento.");

  // Identifica qual ID usar dependendo de onde o modal foi aberto
  const idLancamento = itemParaBaixar ? itemParaBaixar.id : lancamentoIdParaBaixaExtrato;

  if (!idLancamento) return alert("❌ Erro: Lançamento não identificado.");

  // CORREÇÃO: Como sua rota no backend é router.post, o método deve ser SEMPRE 'POST'
  const metodoHTTP = 'POST';

  const resultado = await apiFetch(`/api/financeiro/baixar/${idLancamento}`, {
    method: metodoHTTP,
    body: JSON.stringify({ metodo_pagamento: metodoSelecionado })
  });

  if (resultado) {
    fecharModal();

    if (itemParaBaixar) {
      // Se veio da tabela principal, atualiza a tela de fora
      carregarDadosEstrategicos();
      alert("Pagamento registrado com sucesso!");
    } else {
      // Se veio da gaveta de extrato, recarrega a gaveta de forma cirúrgica
      const textoNome = document.getElementById('extratoPacienteNome').innerText;
      const pacienteNome = textoNome.replace(/paciente:\s*/i, '').trim();
      await abrirExtratoPaciente(pacienteIdParaBaixaExtrato, pacienteNome);
      // Atualiza os cards de fora também para o saldo não ficar desatualizado
      await carregarDadosEstrategicos();
    }
  }
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
// =============================================================================
// 🔍 --6.1 SISTEMA DE PESQUISA EM TEMPO REAL (NOME, CPF OU TELEFONE)
// =============================================================================

// Executa assim que o DOM estiver totalmente carregado para garantir que os elementos existem
document.addEventListener('DOMContentLoaded', () => {
  // Localiza o input de busca. Ajuste o ID se no seu HTML ele tiver outro nome (ex: id="buscaFinanceiro")
  const inputBusca = document.getElementById('buscaFinanceiro') || document.querySelector('input[placeholder*="Nome, CPF ou telefone"]');

  if (!inputBusca) {
    console.warn("⚠️ Input de busca por 'Nome, CPF ou telefone' não foi encontrado no HTML.");
    return;
  }

  // Escuta o evento 'input' (dispara a cada tecla digitada ou texto colado)
  inputBusca.addEventListener('input', (event) => {
    const termoPesquisa = event.target.value.toLowerCase().trim();

    // Se o campo estiver vazio, renderiza a lista completa original
    if (termoPesquisa === '') {
      renderizar(lancamentos);
      return;
    }

    // Filtra a lista global baseada nos três critérios desejados
    const lancamentosFiltrados = lancamentos.filter(item => {
      const nome = item.paciente_nome ? item.paciente_nome.toLowerCase() : '';
      const cpf = item.paciente_cpf ? String(item.paciente_cpf).replace(/\D/g, '') : '';
      const telefone = item.paciente_tel ? String(item.paciente_tel).replace(/\D/g, '') : '';

      // Limpa também o termo digitado caso o usuário digite pontos/traços no CPF ou fone
      const termoLimpo = termoPesquisa.replace(/\D/g, '');

      // Verifica se o termo bate com o Nome OU se o termo limpo está incluso no CPF ou Telefone
      const bateNome = nome.includes(termoPesquisa);
      const bateCPF = termoLimpo !== '' && cpf.includes(termoLimpo);
      const bateTelefone = termoLimpo !== '' && telefone.includes(termoLimpo);

      return bateNome || bateCPF || bateTelefone;
    });

    // Atualiza a tabela principal instantaneamente com o resultado do filtro
    renderizar(lancamentosFiltrados);
  });
});

// =============================================================================
// 7.0 FUNÇÕES DA GAVETA DE EXTRATO FINANCEIRO DO PACIENTE
// =============================================================================

async function abrirExtratoPaciente(pacienteId, pacienteNome) {
  const gaveta = document.getElementById('gavetaExtrato');
  const backdrop = document.getElementById('backdropExtrato');

  if (!gaveta || !backdrop) return;

  if (document.getElementById('extratoPacienteId')) {
    document.getElementById('extratoPacienteId').value = pacienteId;
  }

  document.getElementById('extratoPacienteNome').innerText = `Paciente: ${pacienteNome}`;

  gaveta.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  setTimeout(() => {
    gaveta.classList.remove('translate-x-full');
  }, 10);

  try {
    const response = await fetch(`/api/financeiro/paciente/${pacienteId}`);
    if (!response.ok) throw new Error('Erro ao buscar extrato.');

    const resultado = await response.json();
    const { resumo, dados } = resultado;

    document.getElementById('extratoCardPago').innerText = resumo.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('extratoCardAberto').innerText = resumo.aberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('extratoCardCancelado').innerText = resumo.cancelado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const tbody = document.getElementById('tabelaExtratoCorpo');
    if (dados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic">Nenhum lançamento encontrado para este paciente.</td></tr>`;
      return;
    }

    tbody.innerHTML = dados.map(item => {
      const dataVenc = item.data_vencimento.includes('T') ? new Date(item.data_vencimento) : new Date(item.data_vencimento + 'T00:00:00');

      let badgeStyle = 'bg-gray-100 text-gray-600';
      if (item.status_pagamento === 'pago') badgeStyle = 'bg-emerald-50 text-emerald-600 font-bold';
      if (item.status_pagamento === 'aberto') badgeStyle = 'bg-blue-50 text-blue-600';
      if (item.status_pagamento === 'cancelado') badgeStyle = 'bg-red-50 text-red-500 line-through';

      let botaoAcao = '';
      if (item.status_pagamento === 'aberto') {
        const valorFormatado = parseFloat(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const nomeTratado = pacienteNome.replace(/'/g, "\\'").replace(/"/g, '\\"');

        botaoAcao = `
          <button onclick="baixarLancamentoAvulso(${item.id}, ${pacienteId}, '${nomeTratado}', '${valorFormatado}')" class="ml-2 p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-600 hover:text-white transition" title="Dar Baixa (Recebido)">
            <i class="fas fa-check text-[10px]"></i>
          </button>
        `;
      }

      return `
              <tr class="hover:bg-gray-50/50 transition">
                  <td class="px-4 py-3 text-gray-500 font-medium">${dataVenc.toLocaleDateString('pt-BR')}</td>
                  <td class="px-4 py-3 flex flex-col">
                      <span class="text-gray-900 font-bold">${item.descricao}</span>
                      <span class="text-[9px] text-indigo-500 uppercase font-black tracking-wider mt-0.5">${item.categoria || 'Consulta'}</span>
                  </td>
                  <td class="px-4 py-3 text-right font-black text-gray-900">
                      ${parseFloat(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td class="px-4 py-3 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold ${badgeStyle}">
                            ${item.status_pagamento}
                        </span>
                        ${botaoAcao} </div>
                  </td>
              </tr>
          `;
    }).join('');

  } catch (error) {
    console.error("Erro na carga do extrato:", error);
    document.getElementById('tabelaExtratoCorpo').innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-red-500 font-bold">Erro interno ao carregar os dados.</td></tr>`;
  }
}

function fecharGavetaExtrato() {
  const gaveta = document.getElementById('gavetaExtrato');
  const backdrop = document.getElementById('backdropExtrato');

  if (!gaveta || !backdrop) return;

  gaveta.classList.add('translate-x-full');

  setTimeout(() => {
    gaveta.classList.add('hidden');
    backdrop.classList.add('hidden');
  }, 300);
}

// =============================================================================
// CONTROLE DO FORMULÁRIO DE GASTOS AVULSOS
// =============================================================================

function abrirFormGastoAvulso() {
  const form = document.getElementById('formGastoAvulso');
  if (!form) return;

  form.classList.remove('hidden');
  document.getElementById('avulsoVencimento').value = new Date().toISOString().split('T')[0];
}

function fecharFormGastoAvulso() {
  const form = document.getElementById('formGastoAvulso');
  const meuForm = document.getElementById('meuFormAvulso');
  if (form) form.classList.add('hidden');
  if (meuForm) meuForm.reset();
}

async function salvarGastoAvulso(event) {
  event.preventDefault();

  const pacienteId = document.getElementById('extratoPacienteId') ? document.getElementById('extratoPacienteId').value : '';
  const descricao = document.getElementById('avulsoDescricao') ? document.getElementById('avulsoDescricao').value : '';
  const categoria = document.getElementById('avulsoCategoria') ? document.getElementById('avulsoCategoria').value : '';
  const valor = document.getElementById('avulsoValor') ? document.getElementById('avulsoValor').value : '';
  const data_vencimento = document.getElementById('avulsoVencimento') ? document.getElementById('avulsoVencimento').value : '';
  const status_pagamento = document.getElementById('avulsoStatus') ? document.getElementById('avulsoStatus').value : '';

  const payload = {
    paciente_id: pacienteId,
    descricao,
    categoria,
    valor,
    data_vencimento,
    status_pagamento,
    tipo: 'receita'
  };

  try {
    const response = await fetch('/api/financeiro/avulso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao salvar o lançamento avulso.');

    fecharFormGastoAvulso();
    const textoNome = document.getElementById('extratoPacienteNome').innerText;
    const pacienteNome = textoNome.replace(/paciente:\s*/i, '').trim();
    await abrirExtratoPaciente(pacienteId, pacienteNome);
    await carregarDadosEstrategicos(); // Garante os cards atualizados lá atrás

  } catch (error) {
    console.error("Erro ao salvar lançamento avulso:", error);
    alert("❌ Não foi possível salvar: " + error.message);
  }
}

// =============================================================================
// 🖨️ GERADOR DE RECIBO DINÂMICO (HTML + JS PURO)
// =============================================================================

async function prepararImpressaoExtrato() {
  // 1. Captura o ID do paciente essencial da Gaveta para fazer a busca no banco
  const pacienteIdInput = document.getElementById('extratoPacienteId');
  const pacienteId = pacienteIdInput ? pacienteIdInput.value : '0';

  if (!pacienteId || pacienteId === '0') {
    alert("⚠️ Erro do Sistema: Não foi possível identificar o ID do paciente na gaveta atual.");
    return;
  }

  // Captura as linhas de movimentação da gaveta antes de ir ao banco
  const linhasTabelaOriginal = document.getElementById('tabelaExtratoCorpo');
  if (!linhasTabelaOriginal || linhasTabelaOriginal.innerText.includes('Nenhum lançamento')) {
    alert("⚠️ Não há lançamentos no histórico para gerar o recibo.");
    return;
  }

  try {
    // 🌟 REQUISIÇÃO AO BANCO DE DADOS: Busca os nomes reais e auditados direto do MySQL
    const resposta = await fetch(`/api/financeiro/recibo-dados/${pacienteId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!resposta.ok) {
      throw new Error(`Erro na requisição: ${resposta.status}`);
    }

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert(`⚠️ Erro ao gerar recibo: ${resultado.error}`);
      return;
    }

    // Variáveis oficiais e seguras injetadas pelo Back-end do MedLM
    const pacienteNome = resultado.pacienteNome;
    const nomeClinica = resultado.clinicaNome;
    const operadorNome = resultado.operadorNome;

    // Captura os saldos dos cards da gaveta
    const valorPago = document.getElementById('extratoCardPago') ? document.getElementById('extratoCardPago').innerText : 'R$ 0,00';
    const valorAberto = document.getElementById('extratoCardAberto') ? document.getElementById('extratoCardAberto').innerText : 'R$ 0,00';

    const dataEmissao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // =============================================================================
    // 🌍 CONFIGURAÇÃO DE AMBIENTE (LOCAL VS PRODUÇÃO)
    // =============================================================================
    // 🛑 EM DESENVOLVIMENTO (LOCAL): Usando localhost com a porta do seu Node
    const urlPortal = `http://localhost:3000/portal/${pacienteId}`;

    // 🚀 EM PRODUÇÃO (SERVIDOR): Descomente a linha abaixo e comente a de cima quando subir o sistema!
    // const urlPortal = `https://medlm.com.br/portal/${pacienteId}`;
    // =============================================================================

    // Gera a URL do QR Code apontando para o ambiente configurado acima
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPortal)}`;

    // 2. Transforma as linhas da tabela em HTML limpo para o recibo
    let linhasHTML = '';
    const linhas = linhasTabelaOriginal.querySelectorAll('tr');

    linhas.forEach(linha => {
      const colunas = linha.querySelectorAll('td');
      if (colunas.length >= 3) {
        const data = colunas[0].innerText;
        const descricao = colunas[1].innerText;
        const valor = colunas[2].innerText;

        linhasHTML += `
          <tr style="border-bottom: 1px solid #eaf2f8;">
              <td style="padding: 10px 5px; font-size: 13px; color: #2c3e50;">${data}</td>
              <td style="padding: 10px 5px; font-size: 13px; font-weight: 600; color: #2c3e50;">${descricao}</td>
              <td style="padding: 10px 5px; text-align: right; font-weight: 600; font-size: 13px; color: #2c3e50;">${valor}</td>
          </tr>
        `;
      }
    });

    // 3. Monta o HTML do Recibo com o exato estilo do seu template elegante
    const containerRecibo = document.getElementById('conteudoRecibo');
    containerRecibo.innerHTML = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0px 10px 30px rgba(0,0,0,0.05); font-family: 'Poppins', Arial, sans-serif;">
          <tr>
            <td align="center" style="padding: 25px 40px; background: linear-gradient(135deg, #1A5FA1 0%, #a8e6cf 100%);">
              <img src="https://i.imgur.com/5pjegDN.png" alt="MedLM Logo" width="180" style="display: block; border: 0;">
            </td>
          </tr>

          <tr>
              <td style="padding: 30px 40px; color: #2c3e50; line-height: 1.6;">
                  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 5px; color: #1A5FA1;">Olá, <strong>${pacienteNome}</strong>!</h1>
                  <p style="font-size: 14px; margin: 0 0 20px; color: #7f8c8d;">Segue o extrato financeiro referente aos seus atendimentos.</p>

                  <div style="background-color: #eaf2f8; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #d4e3ef;">
                      <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 5px; color: #1A5FA1; text-transform: uppercase;">Dados de Emissão</h3>
                      <p style="font-size: 13px; font-weight: 300; margin: 0; line-height: 1.5;">
                          <strong>Clínica:</strong> ${nomeClinica}<br>
                          <strong>Operador:</strong> ${operadorNome}<br>
                          <strong>Data/Hora:</strong> ${dataEmissao}
                      </p>
                  </div>

                  <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 10px; text-transform: uppercase; color: #2c3e50;">Histórico de Movimentações</h3>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; border-collapse: collapse;">
                      <thead>
                          <tr style="border-bottom: 2px solid #eaf2f8; text-align: left;">
                              <th style="padding: 8px 5px; color: #7f8c8d; font-size: 11px; text-transform: uppercase; width: 25%;">Vencimento</th>
                              <th style="padding: 8px 5px; color: #7f8c8d; font-size: 11px; text-transform: uppercase; width: 50%;">Descrição</th>
                              <th style="padding: 8px 5px; color: #7f8c8d; font-size: 11px; text-transform: uppercase; text-align: right; width: 25%;">Valor</th>
                          </tr>
                      </thead>
                      <tbody style="color: #2c3e50;">
                          ${linhasHTML}
                      </tbody>
                  </table>

                  <div style="background-color: #fef9c3; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #fde047;">
                      <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 5px; color: #856404; text-transform: uppercase;">Resumo Financeiro</h3>
                      <p style="font-size: 14px; font-weight: 600; margin: 0; color: #856404;">
                          <span style="display: inline-block; width: 130px;">Total Recebido:</span> <span style="color: #10b981;">${valorPago}</span><br>
                          <span style="display: inline-block; width: 130px; margin-top: 3px;">Saldo em Aberto:</span> <span style="color: #1A5FA1;">${valorAberto}</span>
                      </p>
                  </div>

                  <div style="text-align: center; background-color: #ffffff; border: 2px dashed #1A5FA1; padding: 20px; border-radius: 15px; margin: 20px 0;">
                      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 5px; color: #1A5FA1;">Validação de Autenticidade</h3>
                      <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">Escaneie o código abaixo para acessar seu portal de agendamento ou validar o documento.</p>

                      <img src="${qrCodeUrl}" alt="QR Code" width="130" style="margin-bottom: 10px;">

                      <p style="font-size: 12px; margin: 0;">
                          <a href="${urlPortal}" target="_blank" style="color: #1A5FA1; font-weight: 600; text-decoration: none;">${urlPortal}</a>
                      </p>
                  </div>
              </td>
          </tr>

          <tr>
              <td align="center" style="padding: 15px 40px; border-top: 1px solid #eeeeee; color: #95a5a6; font-size: 11px; font-weight: 300;">
                  © ${new Date().getFullYear()} MedLM - Sistema Clínico Inteligente
              </td>
          </tr>
      </table>
    `;

    // Guarda o ID do paciente ativo no escopo global ou em um atributo do modal para o envio de e-mail saber quem é
    document.getElementById('modalImpressaoRecibo').dataset.pacienteId = pacienteId;

    // 4. Exibe o modal na tela
    document.getElementById('modalImpressaoRecibo').classList.remove('hidden');

  } catch (erro) {
    console.error("Falha ao buscar dados do banco para o recibo:", erro);
    alert("⚠️ Erro de Comunicação: Não foi possível carregar os dados oficiais da clínica e do paciente do servidor.");
  }
}
// =============================================================================
// 📧 DISPARADOR DE E-MAIL VIA BACK-END (INTEGRAÇÃO NOTIFICATION SERVICE)
// =============================================================================
async function dispararReciboEmail() {
  // 💡 CORREÇÃO 1: Captura o ID direto do input oculto que o seu sistema já preenche
  const pacienteId = document.getElementById('extratoPacienteId')?.value;
  const btnEmail = document.getElementById('btnEnviarEmailRecibo');

  if (!pacienteId) {
    alert("⚠️ Erro: Paciente não identificado para envio.");
    return;
  }

  // Feedback visual de carregamento no botão
  const textoOriginal = btnEmail.innerHTML;
  btnEmail.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando...`;
  btnEmail.disabled = true;

  try {
    // 💡 CORREÇÃO 2: Mudamos para 'apiFetch' para herdar a segurança/Token do MedLM de forma transparente
    const dados = await apiFetch(`/api/financeiro/enviar-recibo-email`, {
      method: 'POST',
      body: JSON.stringify({ pacienteId })
    });

    if (dados && dados.success) {
      alert("🚀 Sucesso! O recibo foi processado e enviado para o e-mail do paciente.");
    } else {
      alert(`⚠️ Falha ao enviar: ${dados?.error || 'Erro desconhecido.'}`);
    }
  } catch (error) {
    console.error("Erro ao disparar fetch de e-mail:", error);
    alert("⚠️ Erro de rede ao tentar conectar com o serviço de notificação.");
  } finally {
    // Restaura o estado original do botão
    btnEmail.innerHTML = textoOriginal;
    btnEmail.disabled = false;
  }
}

// 💡 CORREÇÃO 3: Mantida apenas uma vez a função de fechar
function fecharModalImpressao() {
  document.getElementById('modalImpressaoRecibo').classList.add('hidden');
}
