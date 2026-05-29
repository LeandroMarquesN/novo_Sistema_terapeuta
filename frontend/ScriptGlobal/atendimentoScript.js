/**
 * MedLM - Inteligência de Atendimento Clínico Multi-tenant
 * Handler oficial refatorado para integração com LEFT JOIN (Pacientes + Agendamentos)
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
        `<i class="fab fa-whatsapp text-emerald-500"></i> ${formatarTelefone(p.telefone)}` : 'Não informado';
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
    if (elementosFicha.condicoes) {
      elementosFicha.condicoes.innerText = p.condicoes_saude || 'Sem condições preexistentes.';
      elementosFicha.condicoes.className = p.condicoes_saude
        ? "bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-700 dark:text-red-300 font-bold leading-relaxed"
        : "bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-700 dark:text-emerald-300 font-bold leading-relaxed";
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
      elementosFicha.timeline.innerHTML = `<div class="text-center text-slate-400 text-xs py-8">Nenhum histórico encontrado.</div>`;
      return;
    }

    elementosFicha.timeline.innerHTML = historico.map(evo => `
      <div class="glass-card p-3 rounded-xl text-left cursor-pointer hover:border-emerald-400 transition" onclick="visualizarEvolucaoAntiga(${evo.id})">
        <div class="flex justify-between border-b border-white/10 pb-1 mb-1">
          <span class="font-black">${new Date(evo.data_registro).toLocaleDateString('pt-BR')}</span>
          <span class="bg-blue-500/20 text-blue-300 px-1.5 rounded text-[9px] uppercase">${evo.codigo_cid || '---'}</span>
        </div>
        <p class="text-slate-400 text-xs truncate">${extrairTextoLimpo(evo.relato_clinico)}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro timeline:', err);
  }
}

// 💾 4. SALVAR EVOLUÇÃO
async function salvarEvolucao(event) {
  if (event) event.preventDefault();

  const payload = {
    pacienteId: elementosFicha.pacienteIdHidden.value,
    agendamentoId: elementosFicha.agendamentoIdHidden?.value,
    codigoCid: elementosFicha.diagnosticoCid?.value.toUpperCase(),
    relatoClinico: quill.getSemanticHTML()
  };

  const response = await fetch('/api/prontuarios/salvar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    alert("✅ Evolução assinada com sucesso!");
    location.reload();
  } else {
    alert("❌ Erro ao salvar.");
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

    // 2. Preenche o Editor Quill com o texto antigo
    // Usamos o delta (conteúdo estruturado) ou HTML puro se preferir
    quill.clipboard.dangerouslyPasteHTML(prontuario.texto_evolucao || prontuario.relato_clinico || '');

    // === ADICIONE ESTA LINHA AQUI ===
    // Isso garante que o botão de Enviar Email saiba qual prontuário está aberto
    document.getElementById('idDoProntuarioAtual').value = prontuarioId;
    // ================================

    // Feedback visual opcional
    // alert("Prontuário carregado com sucesso!");

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

// Isso garante que a função fique visível para o clique no HTML
window.visualizarEvolucaoAntiga = visualizarEvolucaoAntiga;

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

window.salvarEvolucao = salvarEvolucao;