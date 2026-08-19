/**
 * MedLM - Inteligência de Atendimento Clínico Multi-tenant
 * Handler oficial refatorado para integração com LEFT JOIN (Pacientes + Agendamentos)
 * + fluxo de assinatura eletrônica por senha e trava visual de prontuário finalizado
 */

const token = localStorage.getItem('token');

// Elementos Globais mapeados da estrutura Glassmorphism
const elementosFicha = {
  clinica: document.getElementById('nomeClinicaHeader'),
  usuario: document.getElementById('nomeUsuarioHeader'),
  pacienteHeader: document.getElementById('nomePacienteHeader'),
  cpf: document.getElementById('infoCpf'),
  email: document.getElementById('infoEmail'),
  whatsapp: document.getElementById('infoWhatsapp'),
  origem: document.getElementById('infoOrigem'),
  nascimento: document.getElementById('infoNascimento'),
  idade: document.getElementById('infoIdade'),
  peso: document.getElementById('infoPeso'),
  altura: document.getElementById('infoAltura'),
  sangue: document.getElementById('infoSangue'),
  motivo: document.getElementById('infoMotivo'),
  condicoes: document.getElementById('infoCondicoes'),
  contadorEvolucoes: document.getElementById('contadorEvolucoes'),
  timeline: document.getElementById('timelineProntuarios'),
  pacienteIdHidden: document.getElementById('atendimentoPacienteId'),
  agendamentoIdHidden: document.getElementById('atendimentoAgendamentoId'),
  diagnosticoCid: document.getElementById('diagnosticoCid')
};

// 🌟 INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const pacienteId = urlParams.get('pacienteId');
  const agendamentoId = urlParams.get('agendamentoId');

  if (pacienteId) {
    if (elementosFicha.pacienteIdHidden) elementosFicha.pacienteIdHidden.value = pacienteId;
    if (elementosFicha.agendamentoIdHidden && agendamentoId) elementosFicha.agendamentoIdHidden.value = agendamentoId;

    carregarDadosSessaoSaaS();
    carregarFichaPaciente(pacienteId);
    carregarTimelineProntuarios(pacienteId);
  } else {
    exibirAvisoSemPaciente();
  }
});

// 🏢 1. DADOS DE SESSÃO
function carregarDadosSessaoSaaS() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = JSON.parse(atob(token.split('.')[1]));

    // Extraindo dados do token
    const nomeUsuario = payload.nome || 'Profissional';
    const cargoUsuario = payload.cargo ? ` - ${payload.cargo.charAt(0).toUpperCase() + payload.cargo.slice(1)}` : '';
    const nomeClinica = payload.nome_clinica || 'Clínica Vinculada';

    // Atualiza o DOM
    if (elementosFicha.clinica) elementosFicha.clinica.innerText = nomeClinica;

    // Aqui incluímos o nome + cargo (ex: Lavinia Marques - Medico)
    if (elementosFicha.usuario) {
      elementosFicha.usuario.innerText = `${nomeUsuario}${cargoUsuario}`;
    }

  } catch (error) {
    console.error('Erro ao carregar sessão:', error);
  }
}

// 👤 2. CARGA DE FICHA (Integrada com Join Agendamentos)
async function carregarFichaPaciente(pacienteId) {
  try {
    const response = await fetch(`/api/pacientes/ficha-express/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Dados não encontrados');
    const p = await response.json();

    // Atualização de elementos com tratamento de nulos
    if (elementosFicha.pacienteHeader) elementosFicha.pacienteHeader.innerText = p.nome?.toUpperCase() || '---';
    if (elementosFicha.cpf) elementosFicha.cpf.innerText = formatarCPF(p.cpf) || 'Não informado';
    if (elementosFicha.email) elementosFicha.email.innerText = p.email || '---';

    // Telefone via Join
    if (elementosFicha.whatsapp) {
      elementosFicha.whatsapp.innerHTML = p.telefone ?
        `<i class="fab fa-whatsapp" style="color:var(--emerald)"></i> ${formatarTelefone(p.telefone)}` : 'Não informado';
    }

    if (elementosFicha.origem) elementosFicha.origem.innerText = p.origem || 'Manual';

    // Datas
    if (p.data_nascimento) {
      const dataFormatada = new Date(p.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      if (elementosFicha.nascimento) elementosFicha.nascimento.innerText = dataFormatada;
      if (elementosFicha.idade) elementosFicha.idade.innerText = `(${calcularIdade(p.data_nascimento)} anos)`;
    }

    // Biometria e Clínica (Campos vindos do Join)
    if (elementosFicha.peso) elementosFicha.peso.innerText = p.peso ? `${p.peso} kg` : '-- kg';
    if (elementosFicha.altura) elementosFicha.altura.innerText = p.altura ? `${p.altura} m` : '-- m';
    if (elementosFicha.sangue) elementosFicha.sangue.innerText = p.tipo_sanguineo || '--';
    if (elementosFicha.motivo) elementosFicha.motivo.innerText = p.motivo_consulta || 'Nenhum motivo registrado.';

    // Condições vindas do Join (p.condicoes_saude mapeado do campo 'condicoes' da tabela agendamentos)
    // CORRIGIDO: cores fixas para tema escuro, sem depender do prefixo "dark:" (que só ativa com o toggle)
    if (elementosFicha.condicoes) {
      elementosFicha.condicoes.innerText = p.condicoes_saude || 'Sem condições preexistentes.';
      elementosFicha.condicoes.className = "p-3 rounded-xl font-bold leading-relaxed";
      if (p.condicoes_saude) {
        elementosFicha.condicoes.style.background = 'rgba(248,113,113,0.1)';
        elementosFicha.condicoes.style.border = '1px solid rgba(248,113,113,0.25)';
        elementosFicha.condicoes.style.color = '#f87171';
      } else {
        elementosFicha.condicoes.style.background = 'rgba(52,211,153,0.1)';
        elementosFicha.condicoes.style.border = '1px solid rgba(52,211,153,0.25)';
        elementosFicha.condicoes.style.color = '#34d399';
      }
    }

  } catch (error) {
    console.error('Erro ao carregar ficha:', error);
  }
}

// ⏱️ 3. TIMELINE (Histórico de Evoluções)
async function carregarTimelineProntuarios(pacienteId) {
  try {
    const response = await fetch(`/api/prontuarios/historico/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const historico = await response.json();

    if (elementosFicha.contadorEvolucoes) elementosFicha.contadorEvolucoes.innerText = historico.length;
    if (!elementosFicha.timeline) return;

    if (historico.length === 0) {
      elementosFicha.timeline.innerHTML = `<div class="text-center text-xs py-8" style="color: rgba(148,163,184,0.4)">Nenhum histórico encontrado.</div>`;
      return;
    }

    elementosFicha.timeline.innerHTML = historico.map(evo => `
      <div class="glass-card p-3 rounded-xl text-left cursor-pointer transition" style="cursor:pointer" onclick="visualizarEvolucaoAntiga(${evo.id})">
        <div class="flex justify-between pb-1 mb-1" style="border-bottom: 1px solid var(--border)">
          <span class="font-black" style="color:#e2e8f0">${new Date(evo.data_registro).toLocaleDateString('pt-BR')}</span>
          <span class="px-1.5 rounded text-[9px] uppercase font-black" style="background: rgba(96,165,250,0.15); color: var(--blue)">${evo.codigo_cid || '---'}</span>
        </div>
        <p class="text-xs truncate" style="color: rgba(148,163,184,0.7)">${extrairTextoLimpo(evo.relato_clinico)}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro timeline:', err);
  }
}

// 💾 4. SALVAR EVOLUÇÃO — agora em duas etapas: abrir modal de senha → confirmar
function salvarEvolucao(event) {
  if (event) event.preventDefault();
  abrirModalAssinatura();
}

function abrirModalAssinatura() {
  const modal = document.getElementById('modalAssinatura');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('senhaAssinatura').value = '';
  document.getElementById('erroSenhaAssinatura').classList.add('hidden');
  setTimeout(() => document.getElementById('senhaAssinatura').focus(), 50);
}

function fecharModalAssinatura() {
  const modal = document.getElementById('modalAssinatura');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function confirmarAssinatura(event) {
  if (event) event.preventDefault();

  const senha = document.getElementById('senhaAssinatura').value;
  const erroEl = document.getElementById('erroSenhaAssinatura');
  const btn = document.getElementById('btnConfirmarAssinatura');

  if (!senha) {
    erroEl.innerText = "Digite sua senha para confirmar.";
    erroEl.classList.remove('hidden');
    return;
  }

  const payload = {
    pacienteId: elementosFicha.pacienteIdHidden.value,
    agendamentoId: elementosFicha.agendamentoIdHidden?.value,
    codigoCid: elementosFicha.diagnosticoCid?.value.toUpperCase(),
    relatoClinico: quill.getSemanticHTML(),
    senhaAssinatura: senha
  };

  try {
    btn.disabled = true;
    btn.innerText = "ASSINANDO...";

    const response = await fetch('/api/prontuarios/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      fecharModalAssinatura();
      alert("✅ Evolução assinada com sucesso!");
      location.reload();
    } else {
      erroEl.innerText = data.erro || "Não foi possível confirmar a assinatura.";
      erroEl.classList.remove('hidden');
    }
  } catch (err) {
    erroEl.innerText = "Erro de conexão. Tente novamente.";
    erroEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerText = "Confirmar Assinatura";
  }
}

// Função para carregar um prontuário antigo no editor
async function visualizarEvolucaoAntiga(prontuarioId) {
  try {
    const response = await fetch(`/api/prontuarios/detalhe/${prontuarioId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Erro ao buscar detalhes');

    const prontuario = await response.json();

    // 1. Preenche o CID
    if (elementosFicha.diagnosticoCid) {
      elementosFicha.diagnosticoCid.value = prontuario.diagnostico_cid || '';
    }

    // 2. Preenche o Editor Quill
    quill.clipboard.dangerouslyPasteHTML(prontuario.texto_evolucao || '');

    // 3. A CONEXÃO QUE FALTAVA:
    // Pega o ID que veio da lista e coloca no campo hidden
    const inputHidden = document.getElementById('idDoProntuarioAtual');
    if (inputHidden) {
      inputHidden.value = prontuarioId;
    }

    // 4. 🔐 Aplica o estado de trava visual (badge + editor bloqueado) conforme o status
    if (typeof aplicarEstadoProntuario === 'function') {
      aplicarEstadoProntuario(prontuario.status_prontuario);
    }

    console.log("Prontuário ID atualizado para:", prontuarioId);

  } catch (err) {
    console.error('Erro ao visualizar evolução:', err);
    alert("Não foi possível carregar esta evolução.");
  }
}
// ==== enviar prontuario por email ====
async function enviarProntuarioEmail() {
  const inputId = document.getElementById('idDoProntuarioAtual');
  const btn = document.getElementById('btnEnviarEmail');

  // Verifica se o input existe e se tem valor
  if (!inputId || !inputId.value) {
    alert("Atenção: Por favor, selecione um prontuário na lista ao lado primeiro.");
    return;
  }

  const prontuarioId = inputId.value;

  try {
    btn.disabled = true;
    btn.innerText = "ENVIANDO...";

    const response = await fetch('/api/prontuarios/enviar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prontuarioId: prontuarioId })
    });

    const data = await response.json();

    if (response.ok) {
      alert("Sucesso! E-mail enviado para o paciente.");
    } else {
      throw new Error(data.erro || "Erro ao enviar.");
    }
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro no envio: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "ENVIAR EMAIL";
  }
}
// ==funcao para auditoria de quem visualizou , enviou, ou modificou o prontuario

async function abrirModalAuditoria() {
  const prontuarioId = document.getElementById('idDoProntuarioAtual').value;
  if (!prontuarioId) {
    alert("Selecione um prontuário primeiro.");
    return;
  }

  document.getElementById('modalAuditoria').classList.remove('hidden');
  document.getElementById('modalAuditoria').classList.add('flex');

  // Busca no Backend (Crie essa rota como te passei antes)
  const response = await fetch(`/api/prontuarios/logs/${prontuarioId}`);
  const logs = await response.json();

  const lista = document.getElementById('listaLogs');
  // CORRIGIDO: reaproveita a classe .audit-item (definida no CSS do atendimento.html)
  // em vez de bg-white/30 + dark:*, que ficava ilegível sem o toggle de dark mode ativo
  lista.innerHTML = logs.map(log => `
      <div class="flex justify-between items-center audit-item">
          <div>
              <p class="text-[11px] font-black" style="color:#e2e8f0">${log.acao}</p>
              <p class="text-[9px]" style="color: rgba(148,163,184,0.6)">Por: ${log.usuario_nome}</p>
          </div>
          <span class="text-[10px] font-bold" style="color: rgba(148,163,184,0.5)">${new Date(log.data_acesso).toLocaleString('pt-BR')}</span>
      </div>
  `).join('');
}

function fecharModalAuditoria() {
  document.getElementById('modalAuditoria').classList.add('hidden');
  document.getElementById('modalAuditoria').classList.remove('flex');
}

// Isso garante que a função fique visível para o clique no HTML
window.visualizarEvolucaoAntiga = visualizarEvolucaoAntiga;
window.salvarEvolucao = salvarEvolucao;
window.confirmarAssinatura = confirmarAssinatura;
window.fecharModalAssinatura = fecharModalAssinatura;
window.abrirModalAuditoria = abrirModalAuditoria;
window.fecharModalAuditoria = fecharModalAuditoria;
window.enviarProntuarioEmail = enviarProntuarioEmail;

// 🧮 AUXILIARES (Refinadas)
function calcularIdade(data) {
  const d = new Date(data);
  return new Date().getFullYear() - d.getFullYear();
}

function formatarCPF(v) {
  return v?.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarTelefone(v) {
  return v?.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}

function extrairTextoLimpo(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

function exibirAvisoSemPaciente() {
  if (elementosFicha.pacienteHeader) elementosFicha.pacienteHeader.innerText = "SELECIONE UM PACIENTE";
}