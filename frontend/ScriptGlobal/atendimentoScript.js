/**
 * MedLM - Inteligência de Atendimento Clínico Multi-tenant
 * + assinatura eletrônica por senha
 * + trava visual de prontuário finalizado
 * + CRM/UF e Cargo do profissional no cabeçalho
 * + Documentos do paciente
 * + Menu mobile
 */

const token = localStorage.getItem('token');

const elementosFicha = {
  clinica: document.getElementById('nomeClinicaHeader'),
  usuario: document.getElementById('nomeUsuarioHeader'),
  cargoUsuario: document.getElementById('cargoUsuarioHeader'),
  crmUsuario: document.getElementById('crmUsuarioHeader'),
  pacienteHeader: document.getElementById('nomePacienteHeader'),
  fotoPaciente: document.getElementById('fotoPacienteHeader'),
  fotoPacienteFallback: document.getElementById('fotoPacienteFallback'),
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
    carregarDocumentosPaciente(pacienteId);
  } else {
    exibirAvisoSemPaciente();
  }

  // Menu mobile
  initMenuMobile();
});

// ─── CRM no cabeçalho ───────────────────────────────────────────
function atualizarCrmNoHeader(crm, ufCrm) {
  if (!elementosFicha.crmUsuario) return;
  if (crm) {
    elementosFicha.crmUsuario.innerText = ufCrm ? `CRM ${crm}/${ufCrm}` : `CRM ${crm}`;
  } else {
    elementosFicha.crmUsuario.innerText = '';
  }
}

// ─── Cargo no cabeçalho ─────────────────────────────────────────
function atualizarCargoNoHeader(cargo) {
  if (!elementosFicha.cargoUsuario) return;
  if (cargo) {
    elementosFicha.cargoUsuario.innerText = cargo.charAt(0).toUpperCase() + cargo.slice(1);
  } else {
    elementosFicha.cargoUsuario.innerText = '';
  }
}

// ─── 1. DADOS DE SESSÃO ─────────────────────────────────────────
function carregarDadosSessaoSaaS() {
  try {
    const tokenLocal = localStorage.getItem('token');
    if (!tokenLocal) return;

    const payload = JSON.parse(atob(tokenLocal.split('.')[1]));
    const nomeUsuario = payload.nome || 'Profissional';
    const nomeClinica = payload.nome_clinica || 'Clínica Vinculada';

    if (elementosFicha.clinica) elementosFicha.clinica.innerText = nomeClinica;
    if (elementosFicha.usuario) elementosFicha.usuario.innerText = nomeUsuario;

    atualizarCargoNoHeader(payload.cargo);
    atualizarCrmNoHeader(payload.crm, payload.uf_crm);
  } catch (error) {
    console.error('Erro ao carregar sessão:', error);
  }
}

// ─── 2. FICHA DO PACIENTE ───────────────────────────────────────
async function carregarFichaPaciente(pacienteId) {
  try {
    const response = await fetch(`/api/pacientes/ficha-express/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Dados não encontrados');
    const p = await response.json();

    if (elementosFicha.pacienteHeader) elementosFicha.pacienteHeader.innerText = p.nome?.toUpperCase() || '---';

    // Foto do paciente (Cloudinary) — cai no ícone padrão se não houver foto ou se o link falhar
    if (elementosFicha.fotoPaciente && elementosFicha.fotoPacienteFallback) {
      if (p.foto_perfil) {
        elementosFicha.fotoPaciente.src = p.foto_perfil;
        elementosFicha.fotoPaciente.onload = () => {
          elementosFicha.fotoPaciente.classList.remove('hidden');
          elementosFicha.fotoPacienteFallback.classList.add('hidden');
        };
        elementosFicha.fotoPaciente.onerror = () => {
          elementosFicha.fotoPaciente.classList.add('hidden');
          elementosFicha.fotoPacienteFallback.classList.remove('hidden');
        };
      } else {
        elementosFicha.fotoPaciente.classList.add('hidden');
        elementosFicha.fotoPacienteFallback.classList.remove('hidden');
      }
    }

    if (elementosFicha.cpf) elementosFicha.cpf.innerText = formatarCPF(p.cpf) || 'Não informado';
    if (elementosFicha.email) elementosFicha.email.innerText = p.email || '---';

    if (elementosFicha.whatsapp) {
      elementosFicha.whatsapp.innerHTML = p.telefone
        ? `<i class="fab fa-whatsapp" style="color:var(--emerald)"></i> ${formatarTelefone(p.telefone)}`
        : 'Não informado';
    }

    if (elementosFicha.origem) elementosFicha.origem.innerText = p.origem || 'Manual';

    if (p.data_nascimento) {
      const dataFormatada = new Date(p.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      if (elementosFicha.nascimento) elementosFicha.nascimento.innerText = dataFormatada;
      if (elementosFicha.idade) elementosFicha.idade.innerText = `(${calcularIdade(p.data_nascimento)} anos)`;
    }

    if (elementosFicha.peso) elementosFicha.peso.innerText = p.peso ? `${p.peso} kg` : '-- kg';
    if (elementosFicha.altura) elementosFicha.altura.innerText = p.altura ? `${p.altura} m` : '-- m';
    if (elementosFicha.sangue) elementosFicha.sangue.innerText = p.tipo_sanguineo || '--';
    if (elementosFicha.motivo) elementosFicha.motivo.innerText = p.motivo_consulta || 'Nenhum motivo registrado.';

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

// ─── 3. TIMELINE ────────────────────────────────────────────────
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

// ─── 4. DOCUMENTOS DO PACIENTE ──────────────────────────────────
async function carregarDocumentosPaciente(pacienteId) {
  const container = document.getElementById('listaDocumentosPaciente');
  if (!container) return;

  try {
    const response = await fetch(`/api/pacientes/${pacienteId}/documentos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Erro ao buscar documentos');

    const documentos = await response.json();

    if (!documentos || documentos.length === 0) {
      container.innerHTML = `
        <div class="text-center text-xs py-4" style="color: rgba(148,163,184,0.4)">
          Nenhum documento enviado pelo paciente.
        </div>`;
      return;
    }

    container.innerHTML = documentos.map(doc => {
      const isPdf = (doc.mime_type || '').includes('pdf');
      const icon = isPdf ? 'fa-file-pdf' : 'fa-file-image';
      const cor = isPdf ? 'var(--red)' : 'var(--cyan)';
      const tamanho = formatarTamanho(doc.tamanho_bytes);
      const data = new Date(doc.criado_em).toLocaleDateString('pt-BR');

      return `
        <a href="${doc.url || '#'}" 
           target="_blank" 
           rel="noopener"
           class="glass-card p-3 flex items-center gap-3 hover:border-emerald-500/40 transition group"
           style="text-decoration:none;">
          <div class="icon-wrap" style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.25); color: ${cor};">
            <i class="fas ${icon} text-sm"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">${doc.nome_original}</p>
            <p class="text-[10px]" style="color: rgba(148,163,184,0.55)">${tamanho} • ${data}</p>
          </div>
          <i class="fas fa-external-link-alt text-[10px] opacity-40 group-hover:opacity-100 transition" style="color: var(--emerald)"></i>
        </a>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro ao carregar documentos:', err);
    container.innerHTML = `
      <div class="text-center text-xs py-4" style="color: rgba(248,113,113,0.7)">
        Erro ao carregar documentos.
      </div>`;
  }
}

function formatarTamanho(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── 5. SALVAR / ASSINAR ────────────────────────────────────────
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

// ─── 6. VISUALIZAR PRONTUÁRIO ANTIGO ────────────────────────────
async function visualizarEvolucaoAntiga(prontuarioId) {
  try {
    const response = await fetch(`/api/prontuarios/detalhe/${prontuarioId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Erro ao buscar detalhes');

    const prontuario = await response.json();

    if (elementosFicha.diagnosticoCid) {
      elementosFicha.diagnosticoCid.value = prontuario.diagnostico_cid || '';
    }

    quill.clipboard.dangerouslyPasteHTML(prontuario.texto_evolucao || '');

    const inputHidden = document.getElementById('idDoProntuarioAtual');
    if (inputHidden) inputHidden.value = prontuarioId;

    if (typeof aplicarEstadoProntuario === 'function') {
      aplicarEstadoProntuario(prontuario.status_prontuario);
    }

    if (elementosFicha.usuario && prontuario.nome_profissional) {
      elementosFicha.usuario.innerText = prontuario.nome_profissional;
    }
    if (prontuario.cargo_profissional) {
      atualizarCargoNoHeader(prontuario.cargo_profissional);
    }
    atualizarCrmNoHeader(prontuario.crm_profissional, prontuario.uf_crm_profissional);

  } catch (err) {
    console.error('Erro ao visualizar evolução:', err);
    alert("Não foi possível carregar esta evolução.");
  }
}

// ─── 7. E-MAIL ──────────────────────────────────────────────────
async function enviarProntuarioEmail() {
  const inputId = document.getElementById('idDoProntuarioAtual');
  const btn = document.getElementById('btnEnviarEmail');

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
      body: JSON.stringify({ prontuarioId })
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

// ─── 8. AUDITORIA ───────────────────────────────────────────────
async function abrirModalAuditoria() {
  const prontuarioId = document.getElementById('idDoProntuarioAtual').value;
  if (!prontuarioId) {
    alert("Selecione um prontuário primeiro.");
    return;
  }

  document.getElementById('modalAuditoria').classList.remove('hidden');
  document.getElementById('modalAuditoria').classList.add('flex');

  const response = await fetch(`/api/prontuarios/logs/${prontuarioId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const logs = await response.json();

  const lista = document.getElementById('listaLogs');

  if (!logs || logs.length === 0) {
    lista.innerHTML = `<p class="text-center text-slate-500 text-xs">Nenhum registro de auditoria encontrado.</p>`;
    return;
  }

  lista.innerHTML = logs.map(log => {
    let crmTexto = '';
    if (log.usuario_crm) {
      crmTexto = log.usuario_uf_crm
        ? `CRM ${log.usuario_crm}/${log.usuario_uf_crm}`
        : `CRM ${log.usuario_crm}`;
    }

    return `
      <div class="flex justify-between items-start audit-item gap-3">
          <div class="min-w-0">
              <p class="text-[11px] font-black" style="color:#e2e8f0">${log.acao}</p>
              <p class="text-[9px] mt-0.5" style="color: rgba(148,163,184,0.6)">
                  Por: <span style="color:#e2e8f0; font-weight:700">${log.usuario_nome || '—'}</span>
              </p>
              ${crmTexto ? `<p class="text-[9px] font-mono mt-0.5" style="color: var(--cyan)">${crmTexto}</p>` : ''}
          </div>
          <span class="text-[10px] font-bold shrink-0" style="color: rgba(148,163,184,0.5)">
              ${new Date(log.data_acesso).toLocaleString('pt-BR')}
          </span>
      </div>
    `;
  }).join('');
}

function fecharModalAuditoria() {
  document.getElementById('modalAuditoria').classList.add('hidden');
  document.getElementById('modalAuditoria').classList.remove('flex');
}

// ─── 9. MENU MOBILE ─────────────────────────────────────────────
function initMenuMobile() {
  const btnMenu = document.getElementById('btnMenuMobile');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlayMenu');
  const iconMenu = document.getElementById('iconMenuMobile');

  if (!btnMenu || !sidebar || !overlay) return;

  function abrirMenu() {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    if (iconMenu) iconMenu.classList.replace('fa-bars', 'fa-times');
  }

  function fecharMenu() {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    if (iconMenu) iconMenu.classList.replace('fa-times', 'fa-bars');
  }

  btnMenu.addEventListener('click', () => {
    const estaAberto = !sidebar.classList.contains('-translate-x-full');
    estaAberto ? fecharMenu() : abrirMenu();
  });

  overlay.addEventListener('click', fecharMenu);

  document.querySelectorAll('#sidebar a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 1024) fecharMenu();
    });
  });
}

// ─── EXPORTS GLOBAIS ────────────────────────────────────────────
window.visualizarEvolucaoAntiga = visualizarEvolucaoAntiga;
window.salvarEvolucao = salvarEvolucao;
window.confirmarAssinatura = confirmarAssinatura;
window.fecharModalAssinatura = fecharModalAssinatura;
window.abrirModalAuditoria = abrirModalAuditoria;
window.fecharModalAuditoria = fecharModalAuditoria;
window.enviarProntuarioEmail = enviarProntuarioEmail;

// ─── AUXILIARES ─────────────────────────────────────────────────
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