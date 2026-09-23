/**
 * MedLM - Inteligência de Atendimento Clínico Multi-tenant
 * + assinatura eletrônica por senha
 * + trava visual de prontuário finalizado
 * + CRM/UF e Cargo do profissional no cabeçalho
 * + Documentos do paciente
 * + Menu mobile
 * + Sistema de Abas (Prontuário / Receituário / Atestados / Exames)
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
    if (elementosFicha.agendamentoIdHidden && agendamentoId) {
      elementosFicha.agendamentoIdHidden.value = agendamentoId;
    }

    carregarDadosSessaoSaaS();
    carregarFichaPaciente(pacienteId);
    carregarTimelineProntuarios(pacienteId);
    carregarDocumentosPaciente(pacienteId);
  } else {
    exibirAvisoSemPaciente();
  }

  initMenuMobile();
});

// ─── SISTEMA DE ABAS ────────────────────────────────────────────
function trocarAba(nomeAba) {
  // Remove active de todas as tabs
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

  // Esconde todos os painéis
  document.querySelectorAll('.aba-painel').forEach(painel => {
    painel.classList.remove('ativa');
  });

  // Ativa a tab clicada
  const tab = document.getElementById('tab-' + nomeAba);
  if (tab) tab.classList.add('active');

  // Mostra o painel correspondente
  const painel = document.getElementById('painel-' + nomeAba);
  if (painel) painel.classList.add('ativa');
}

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

    if (elementosFicha.pacienteHeader) {
      elementosFicha.pacienteHeader.innerText = p.nome?.toUpperCase() || '---';
    }

    // Foto do paciente
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

// ─── 3. TIMELINE (prontuários + anamneses unificados) ───────────
async function carregarTimelineProntuarios(pacienteId) {
  try {
    const response = await fetch(`/api/prontuarios/historico/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const historico = await response.json();

    if (elementosFicha.contadorEvolucoes) {
      elementosFicha.contadorEvolucoes.innerText = Array.isArray(historico) ? historico.length : 0;
    }
    if (!elementosFicha.timeline) return;

    if (!Array.isArray(historico) || historico.length === 0) {
      elementosFicha.timeline.innerHTML = `
        <div class="text-center text-xs py-8" style="color: rgba(148,163,184,0.4)">
          Nenhum histórico encontrado.
        </div>`;
      return;
    }

    elementosFicha.timeline.innerHTML = historico.map((evo) => {
      const tipo = evo.tipo || 'prontuario';
      const dataFmt = evo.data_registro
        ? new Date(evo.data_registro).toLocaleDateString('pt-BR')
        : '—';

      if (tipo === 'anamnese') {
        const icone = evo.modelo_icone || 'fa-clipboard-list';
        const titulo = evo.modelo_nome || 'Anamnese';
        const status = evo.status || 'rascunho';
        const badgeBg = status === 'finalizado'
          ? 'rgba(52,211,153,0.15)'
          : 'rgba(251,191,36,0.15)';
        const badgeCor = status === 'finalizado' ? 'var(--emerald)' : 'var(--amber)';
        const vinculo = evo.prontuario_id_ref
          ? ' · vinculada ao prontuário #' + evo.prontuario_id_ref
          : '';

        return `
          <div class="glass-card p-3 rounded-xl text-left cursor-pointer transition"
               style="border-left: 3px solid var(--blue)"
               onclick="visualizarAnamneseTimeline(${evo.id})">
            <div class="flex justify-between pb-1 mb-1" style="border-bottom: 1px solid var(--border)">
              <span class="font-black flex items-center gap-1.5" style="color:#e2e8f0">
                <i class="fas ${icone} text-[10px]" style="color:var(--blue)"></i>
                ${dataFmt}
              </span>
              <span class="px-1.5 rounded text-[9px] uppercase font-black"
                    style="background: ${badgeBg}; color: ${badgeCor}">
                ${status}
              </span>
            </div>
            <p class="text-xs font-bold truncate" style="color: #cbd5e1">${titulo}</p>
            <p class="text-[10px] mt-0.5 truncate" style="color: rgba(148,163,184,0.55)">
              ${evo.profissional_nome || 'Profissional'} · Anamnese${vinculo}
            </p>
          </div>
        `;
      }

      return `
        <div class="glass-card p-3 rounded-xl text-left cursor-pointer transition"
             onclick="visualizarEvolucaoAntiga(${evo.id})">
          <div class="flex justify-between pb-1 mb-1" style="border-bottom: 1px solid var(--border)">
            <span class="font-black flex items-center gap-1.5" style="color:#e2e8f0">
              <i class="fas fa-notes-medical text-[10px]" style="color:var(--emerald)"></i>
              ${dataFmt}
            </span>
            <span class="px-1.5 rounded text-[9px] uppercase font-black"
                  style="background: rgba(96,165,250,0.15); color: var(--blue)">
              ${evo.codigo_cid || '---'}
            </span>
          </div>
          <p class="text-xs truncate" style="color: rgba(148,163,184,0.7)">
            ${extrairTextoLimpo(evo.relato_clinico)}
          </p>
          ${evo.profissional_nome ? `
            <p class="text-[10px] mt-0.5 truncate" style="color: rgba(148,163,184,0.45)">
              ${evo.profissional_nome}
            </p>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro timeline:', err);
  }
}

/**
 * Abre anamnese em janela flutuante (mesmo esquema das seções maximizadas).
 */
async function visualizarAnamneseTimeline(anamneseId) {
  try {
    const response = await fetch(`/api/anamnese/detalhe/${anamneseId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Falha ao carregar anamnese');

    const data = await response.json();
    const a = data.anamnese || data;
    const respostas = a.respostas || {};
    const dataFmt = a.data_preenchimento
      ? new Date(a.data_preenchimento).toLocaleString('pt-BR')
      : '—';
    const status = a.status_anamnese || 'rascunho';
    const statusCor = status === 'finalizado' ? 'var(--emerald)' : 'var(--amber)';
    const statusBg = status === 'finalizado' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)';
    const tituloJanela = (a.modelo_nome || 'Anamnese') + ' · #' + a.id;
    const pidVinculo = a.prontuario_id ? Number(a.prontuario_id) : null;

    let respostasHtml = '';
    const keys = Object.keys(respostas);
    if (!keys.length) {
      respostasHtml = '<p style="color:rgba(148,163,184,0.5);font-size:12px;padding:12px 0">Nenhuma resposta registrada.</p>';
    } else {
      keys.forEach((k) => {
        const v = respostas[k];
        if (v === false || v === '' || v == null) return;
        if (v === true) {
          respostasHtml += `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(52,211,153,0.1)">
              <i class="fas fa-check-circle" style="color:var(--emerald);font-size:12px"></i>
              <span style="color:#e2e8f0;font-size:13px;font-weight:600">${escHtmlAnamnese(k)}</span>
            </div>`;
        } else {
          respostasHtml += `
            <div style="padding:10px 0;border-bottom:1px solid rgba(52,211,153,0.1)">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(148,163,184,0.5);margin-bottom:4px">${escHtmlAnamnese(k)}</div>
              <div style="color:#e2e8f0;font-size:13px;line-height:1.45;white-space:pre-wrap">${escHtmlAnamnese(String(v))}</div>
            </div>`;
        }
      });
    }

    const corpo = document.createElement('div');
    corpo.className = 'anamnese-detalhe-view';
    corpo.style.cssText = 'padding:4px 2px 12px;';
    corpo.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <span style="font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:99px;background:${statusBg};color:${statusCor}">${escHtmlAnamnese(status)}</span>
        <span style="font-size:11px;color:rgba(148,163,184,0.7);display:flex;align-items:center;gap:6px">
          <i class="fas fa-calendar-alt" style="color:var(--cyan)"></i> ${escHtmlAnamnese(dataFmt)}
        </span>
        ${a.profissional_nome ? `
        <span style="font-size:11px;color:rgba(148,163,184,0.7);display:flex;align-items:center;gap:6px">
          <i class="fas fa-user-md" style="color:var(--emerald)"></i> ${escHtmlAnamnese(a.profissional_nome)}
        </span>` : ''}
        ${pidVinculo ? `
        <span style="font-size:11px;color:rgba(148,163,184,0.7);display:flex;align-items:center;gap:6px">
          <i class="fas fa-link" style="color:var(--blue)"></i> Prontuário #${pidVinculo}
        </span>` : ''}
      </div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:rgba(148,163,184,0.45);margin-bottom:8px">Respostas</div>
      <div>${respostasHtml}</div>
      ${pidVinculo ? `
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(52,211,153,0.15)">
        <button type="button" id="btnAbrirProntVinculo_${anamneseId}"
                class="btn-secondary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
          <i class="fas fa-notes-medical"></i> Abrir prontuário vinculado #${pidVinculo}
        </button>
      </div>` : `
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(52,211,153,0.15)">
        <p style="font-size:11px;color:rgba(148,163,184,0.5)">Esta anamnese ainda não está vinculada a um prontuário.</p>
      </div>`}
    `;

    if (typeof window.abrirJanelaConteudo === 'function') {
      window.abrirJanelaConteudo('anamnese-view-' + anamneseId, tituloJanela, corpo);
    } else {
      abrirModalAnamneseFallback(tituloJanela, corpo);
    }

    // Bind botão DEPOIS de inserir no DOM (evita onclick quebrado / id errado)
    if (pidVinculo) {
      setTimeout(() => {
        const btn = document.getElementById('btnAbrirProntVinculo_' + anamneseId);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            abrirProntuarioVinculado(pidVinculo);
          });
        }
      }, 50);
    }
  } catch (err) {
    console.error('Erro ao visualizar anamnese:', err);
    alert('Não foi possível carregar esta anamnese.');
  }
}

/**
 * Abre o prontuário correto pelo ID, validando paciente do atendimento.
 */
async function abrirProntuarioVinculado(prontuarioId) {
  const id = Number(prontuarioId);
  if (!id) {
    alert('Prontuário vinculado inválido.');
    return;
  }

  const pacienteAtual = document.getElementById('atendimentoPacienteId')?.value;

  try {
    const response = await fetch(`/api/prontuarios/detalhe/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Prontuário não encontrado');

    const prontuario = await response.json();

    // Segurança: não abrir prontuário de outro paciente
    if (pacienteAtual && prontuario.paciente_id && String(prontuario.paciente_id) !== String(pacienteAtual)) {
      alert('Este prontuário não pertence ao paciente do atendimento atual.');
      return;
    }

    // Garante aba de prontuário ativa (HTML e script)
    if (typeof trocarAba === 'function') trocarAba('prontuario');
    if (typeof window.trocarAba === 'function') window.trocarAba('prontuario');

    if (elementosFicha.diagnosticoCid) {
      elementosFicha.diagnosticoCid.value = prontuario.diagnostico_cid || '';
    }

    if (typeof quill !== 'undefined' && quill) {
      quill.clipboard.dangerouslyPasteHTML(prontuario.texto_evolucao || '');
    }

    const inputHidden = document.getElementById('idDoProntuarioAtual');
    if (inputHidden) inputHidden.value = String(id);

    if (typeof aplicarEstadoProntuario === 'function') {
      aplicarEstadoProntuario(prontuario.status_prontuario);
    }

    if (elementosFicha.usuario && prontuario.nome_profissional) {
      elementosFicha.usuario.innerText = prontuario.nome_profissional;
    }
    atualizarCrmNoHeader(prontuario.crm_profissional, prontuario.uf_crm_profissional);

    // Scroll suave até o editor
    const painel = document.getElementById('painel-prontuario');
    if (painel) painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error('Erro ao abrir prontuário vinculado:', err);
    alert('Não foi possível abrir o prontuário #' + id + '.');
  }
}

function escHtmlAnamnese(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function abrirModalAnamneseFallback(titulo, corpoEl) {
  let overlay = document.getElementById('modalAnamneseDetalhe');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalAnamneseDetalhe';
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4';
    overlay.style.background = 'rgba(2,12,18,0.72)';
    overlay.innerHTML = `
      <div class="modal-panel glass-panel w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
        <div class="glass-header px-5 py-3 flex items-center justify-between shrink-0">
          <h3 id="modalAnamneseTitulo" class="text-sm font-black text-white truncate pr-3"></h3>
          <button type="button" id="btnFecharModalAnamnese" class="btn-secondary w-8 h-8 rounded-lg flex items-center justify-center">
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>
        <div id="modalAnamneseBody" class="flex-1 overflow-y-auto px-5 py-4"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
    document.getElementById('btnFecharModalAnamnese').addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
  }
  document.getElementById('modalAnamneseTitulo').textContent = titulo;
  const body = document.getElementById('modalAnamneseBody');
  body.innerHTML = '';
  body.appendChild(corpoEl);
  overlay.classList.remove('hidden');
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
        <a href="${doc.url || '#'}" target="_blank" rel="noopener"
           class="glass-card p-3 flex items-center gap-3 hover:border-emerald-500/40 transition group"
           style="text-decoration:none;">
          <div class="icon-wrap" style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.25); color: ${cor};">
            <i class="fas ${icon} text-sm"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
              ${doc.nome_original}
            </p>
            <p class="text-[10px]" style="color: rgba(148,163,184,0.55)">
              ${tamanho} • ${data}
            </p>
          </div>
          <i class="fas fa-external-link-alt text-[10px] opacity-40 group-hover:opacity-100 transition"
             style="color: var(--emerald)"></i>
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      fecharModalAssinatura();
      if (data.prontuarioId) {
        window.ultimoProntuarioId = data.prontuarioId;
        const inputHidden = document.getElementById('idDoProntuarioAtual');
        if (inputHidden) inputHidden.value = String(data.prontuarioId);
        try { localStorage.setItem('ultimoProntuarioId_' + payload.pacienteId, String(data.prontuarioId)); } catch (_) {}
      }
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

    // Garante que a aba de prontuário esteja ativa
    trocarAba('prontuario');

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

// =========================================================
// RECEITUÁRIO DIGITAL
// =========================================================
let medicamentosReceita = [];

function atualizarCrmReceita() {
  try {
    const tokenLocal = localStorage.getItem('token');
    if (!tokenLocal) return;
    const payload = JSON.parse(atob(tokenLocal.split('.')[1]));
    const el = document.getElementById('receitaCrmInfo');
    if (el) {
      if (payload.crm) {
        el.innerText = payload.uf_crm
          ? `CRM ${payload.crm}/${payload.uf_crm}`
          : `CRM ${payload.crm}`;
      } else {
        el.innerText = 'CRM não cadastrado';
      }
    }
  } catch (e) { }
}

function adicionarMedicamento() {
  const nome = document.getElementById('medNome').value.trim();
  const concentracao = document.getElementById('medConcentracao').value.trim();
  const forma = document.getElementById('medForma').value;
  const quantidade = document.getElementById('medQuantidade').value.trim();
  const via = document.getElementById('medVia').value;
  const posologia = document.getElementById('medPosologia').value.trim();
  const continuo = document.getElementById('medContinuo').checked;

  if (!nome || !quantidade || !posologia) {
    alert('Preencha pelo menos: Nome, Quantidade e Posologia.');
    return;
  }

  medicamentosReceita.push({
    medicamento_nome: nome,
    concentracao: concentracao || null,
    forma_farmaceutica: forma || null,
    quantidade,
    posologia,
    via_administracao: via || 'Oral',
    uso_continuo: continuo
  });

  // Limpa formulário
  document.getElementById('medNome').value = '';
  document.getElementById('medConcentracao').value = '';
  document.getElementById('medForma').value = '';
  document.getElementById('medQuantidade').value = '';
  document.getElementById('medVia').value = 'Oral';
  document.getElementById('medPosologia').value = '';
  document.getElementById('medContinuo').checked = false;

  renderizarMedicamentos();
}

function removerMedicamento(index) {
  medicamentosReceita.splice(index, 1);
  renderizarMedicamentos();
}

function renderizarMedicamentos() {
  const container = document.getElementById('listaMedicamentos');
  const contador = document.getElementById('contadorMedicamentos');

  if (contador) contador.innerText = medicamentosReceita.length;

  if (medicamentosReceita.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10" style="color: rgba(148,163,184,0.35)">
        <i class="fas fa-prescription-bottle text-3xl mb-3 block"></i>
        <p class="text-xs">Nenhum medicamento adicionado ainda</p>
      </div>`;
    return;
  }

  container.innerHTML = medicamentosReceita.map((med, i) => `
    <div class="glass-card p-3 flex gap-3 items-start">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-black text-white truncate">
          ${med.medicamento_nome}
          ${med.concentracao ? `<span class="text-xs font-normal" style="color:var(--cyan)"> ${med.concentracao}</span>` : ''}
        </p>
        <p class="text-[11px] mt-0.5" style="color: rgba(148,163,184,0.7)">
          ${med.forma_farmaceutica || ''} ${med.quantidade} • Via ${med.via_administracao}
          ${med.uso_continuo ? ' • <span style="color:var(--amber)">Uso contínuo</span>' : ''}
        </p>
        <p class="text-[11px] mt-1 italic" style="color: rgba(203,213,225,0.8)">
          ${med.posologia}
        </p>
      </div>
      <button type="button" onclick="removerMedicamento(${i})"
              class="text-slate-500 hover:text-red-400 transition p-1.5 rounded-lg"
              title="Remover">
        <i class="fas fa-trash-alt text-xs"></i>
      </button>
    </div>
  `).join('');
}

async function emitirReceita(assinar) {
  const pacienteId = document.getElementById('atendimentoPacienteId')?.value;
  if (!pacienteId) {
    alert('Nenhum paciente selecionado.');
    return;
  }

  if (medicamentosReceita.length === 0) {
    alert('Adicione pelo menos um medicamento antes de salvar.');
    return;
  }

  let senhaAssinatura = null;

  if (assinar) {
    // Usa o mesmo modal de assinatura do prontuário
    return new Promise((resolve) => {
      window._callbackAssinaturaReceita = async (senha) => {
        await salvarReceitaNoBackend(true, senha);
        resolve();
      };
      abrirModalAssinatura();
      // Sobrescreve temporariamente o confirmarAssinatura
      const original = window.confirmarAssinatura;
      window.confirmarAssinatura = async function (e) {
        if (e) e.preventDefault();
        const senha = document.getElementById('senhaAssinatura').value;
        if (!senha) {
          document.getElementById('erroSenhaAssinatura').innerText = 'Digite sua senha.';
          document.getElementById('erroSenhaAssinatura').classList.remove('hidden');
          return;
        }
        fecharModalAssinatura();
        window.confirmarAssinatura = original; // restaura
        await salvarReceitaNoBackend(true, senha);
      };
    });
  } else {
    await salvarReceitaNoBackend(false, null);
  }
}

async function salvarReceitaNoBackend(assinar, senha) {
  const pacienteId = document.getElementById('atendimentoPacienteId').value;
  const agendamentoId = document.getElementById('atendimentoAgendamentoId')?.value || null;
  const observacoes = document.getElementById('receitaObservacoes').value.trim();
  const validadeDias = parseInt(document.getElementById('receitaValidade').value) || 30;

  const payload = {
    pacienteId: parseInt(pacienteId),
    agendamentoId: agendamentoId ? parseInt(agendamentoId) : null,
    observacoes: observacoes || null,
    validadeDias,
    itens: medicamentosReceita,
    apenasRascunho: !assinar,
    senhaAssinatura: senha || undefined
  };

  try {
    const response = await fetch('/api/receitas/salvar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      alert(assinar ? '✅ Receita emitida e assinada com sucesso!' : '✅ Rascunho salvo com sucesso!');
      if (assinar && data.receitaId) {
        ultimaReceitaEmitidaId = data.receitaId;
      }
      medicamentosReceita = [];
      renderizarMedicamentos();
      document.getElementById('receitaObservacoes').value = '';
      carregarHistoricoReceitas(pacienteId);
    } else {
      alert(data.erro || 'Erro ao salvar receita.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao salvar receita.');
  }
}

async function carregarHistoricoReceitas(pacienteId) {
  const container = document.getElementById('historicoReceitas');
  if (!container || !pacienteId) return;

  try {
    const response = await fetch(`/api/receitas/paciente/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const lista = await response.json();

    if (!lista || lista.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-xs" style="color: rgba(148,163,184,0.35)">
          Nenhuma receita encontrada.
        </div>`;
      return;
    }

    container.innerHTML = lista.map(r => `
      <div class="glass-card p-3 cursor-pointer hover:border-cyan-500/40 transition"
           onclick="verDetalheReceita(${r.id})">
        <div class="flex justify-between items-start gap-2">
          <div>
            <p class="text-xs font-black text-white">
              ${r.total_itens} medicamento${r.total_itens > 1 ? 's' : ''}
            </p>
            <p class="text-[10px] mt-0.5" style="color: rgba(148,163,184,0.6)">
              ${new Date(r.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style="background: ${r.status_receita === 'emitido' ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.15)'};
                       color: ${r.status_receita === 'emitido' ? 'var(--emerald)' : '#94a3b8'}">
            ${r.status_receita}
          </span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar histórico de receitas:', err);
    container.innerHTML = `<div class="text-center py-4 text-xs text-red-400">Erro ao carregar</div>`;
  }
}

async function verDetalheReceita(id) {
  try {
    const response = await fetch(`/api/receitas/detalhe/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const receita = await response.json();

    if (!response.ok) {
      alert(receita.erro || 'Erro ao carregar receita');
      return;
    }

    // Monta um alert simples por enquanto (depois podemos fazer modal bonito)
    let texto = `Receita #${receita.id} — ${receita.status_receita.toUpperCase()}\n\n`;
    texto += `Profissional: ${receita.profissional_nome}`;
    if (receita.profissional_crm) texto += ` — CRM ${receita.profissional_crm}/${receita.profissional_uf_crm || ''}`;
    texto += `\n\nMedicamentos:\n`;
    receita.itens.forEach((item, i) => {
      texto += `${i + 1}. ${item.medicamento_nome} ${item.concentracao || ''}\n`;
      texto += `   ${item.quantidade} — ${item.posologia}\n\n`;
    });
    if (receita.observacoes) texto += `Obs: ${receita.observacoes}`;

    alert(texto);
  } catch (err) {
    alert('Erro ao carregar detalhes da receita.');
  }
}

// ─── EXPORTS GLOBAIS ────────────────────────────────────────────
window.trocarAba = trocarAba;
window.visualizarEvolucaoAntiga = visualizarEvolucaoAntiga;
window.visualizarAnamneseTimeline = visualizarAnamneseTimeline;
window.abrirProntuarioVinculado = abrirProntuarioVinculado;
window.carregarTimelineProntuarios = carregarTimelineProntuarios;
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
  if (elementosFicha.pacienteHeader) {
    elementosFicha.pacienteHeader.innerText = "SELECIONE UM PACIENTE";
  }
}
// =========================================================
// ATESTADOS MÉDICOS
// =========================================================
let tipoAtestadoAtual = 'afastamento';

function selecionarTipoAtestado(tipo) {
  tipoAtestadoAtual = tipo;

  document.querySelectorAll('.tipo-atestado-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById('tipo-' + tipo);
  if (btn) btn.classList.add('active');

  // Mostra/esconde campos de dias
  const campoDias = document.getElementById('campoDiasAfastamento');
  if (campoDias) {
    campoDias.style.display = (tipo === 'afastamento') ? 'grid' : 'none';
  }
}

function atualizarCrmAtestado() {
  try {
    const tokenLocal = localStorage.getItem('token');
    if (!tokenLocal) return;
    const payload = JSON.parse(atob(tokenLocal.split('.')[1]));
    const el = document.getElementById('atestadoCrmInfo');
    if (el) {
      el.innerText = payload.crm
        ? (payload.uf_crm ? `CRM ${payload.crm}/${payload.uf_crm}` : `CRM ${payload.crm}`)
        : 'CRM não cadastrado';
    }
  } catch (e) { }
}

async function emitirAtestado(assinar) {
  const pacienteId = document.getElementById('atendimentoPacienteId')?.value;
  if (!pacienteId) {
    alert('Nenhum paciente selecionado.');
    return;
  }

  if (tipoAtestadoAtual === 'afastamento') {
    const dias = parseInt(document.getElementById('atestadoDias').value);
    if (!dias || dias < 1) {
      alert('Informe a quantidade de dias de afastamento.');
      return;
    }
  }

  if (assinar) {
    // Reutiliza o modal de assinatura
    const original = window.confirmarAssinatura;
    window.confirmarAssinatura = async function (e) {
      if (e) e.preventDefault();
      const senha = document.getElementById('senhaAssinatura').value;
      if (!senha) {
        document.getElementById('erroSenhaAssinatura').innerText = 'Digite sua senha.';
        document.getElementById('erroSenhaAssinatura').classList.remove('hidden');
        return;
      }
      fecharModalAssinatura();
      window.confirmarAssinatura = original;
      await salvarAtestadoNoBackend(true, senha);
    };
    abrirModalAssinatura();
  } else {
    await salvarAtestadoNoBackend(false, null);
  }
}

async function salvarAtestadoNoBackend(assinar, senha) {
  const pacienteId = document.getElementById('atendimentoPacienteId').value;
  const agendamentoId = document.getElementById('atendimentoAgendamentoId')?.value || null;

  const payload = {
    pacienteId: parseInt(pacienteId),
    agendamentoId: agendamentoId ? parseInt(agendamentoId) : null,
    tipoAtestado: tipoAtestadoAtual,
    diasAfastamento: tipoAtestadoAtual === 'afastamento'
      ? parseInt(document.getElementById('atestadoDias').value)
      : null,
    dataInicio: document.getElementById('atestadoDataInicio').value || null,
    dataFim: document.getElementById('atestadoDataFim').value || null,
    cid: document.getElementById('atestadoCid').value.trim().toUpperCase() || null,
    textoLivre: document.getElementById('atestadoTextoLivre').value.trim() || null,
    localAtendimento: document.getElementById('atestadoLocal').value.trim() || null,
    apenasRascunho: !assinar,
    senhaAssinatura: senha || undefined
  };

  try {
    const response = await fetch('/api/atestados/salvar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      alert(assinar ? '✅ Atestado emitido e assinado com sucesso!' : '✅ Rascunho salvo com sucesso!');
      if (assinar && data.atestadoId) {
        ultimoAtestadoEmitidoId = data.atestadoId;
      }
      // Limpa formulário
      document.getElementById('atestadoDias').value = 1;
      document.getElementById('atestadoDataInicio').value = '';
      document.getElementById('atestadoDataFim').value = '';
      document.getElementById('atestadoCid').value = '';
      document.getElementById('atestadoTextoLivre').value = '';
      document.getElementById('atestadoLocal').value = '';
      carregarHistoricoAtestados(pacienteId);
    } else {
      alert(data.erro || 'Erro ao salvar atestado.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao salvar atestado.');
  }
}

async function carregarHistoricoAtestados(pacienteId) {
  const container = document.getElementById('historicoAtestados');
  if (!container || !pacienteId) return;

  try {
    const response = await fetch(`/api/atestados/paciente/${pacienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const lista = await response.json();

    if (!lista || lista.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-xs" style="color: rgba(148,163,184,0.35)">
          Nenhum atestado encontrado.
        </div>`;
      return;
    }

    container.innerHTML = lista.map(a => `
      <div class="glass-card p-3 cursor-pointer hover:border-emerald-500/40 transition"
           onclick="verDetalheAtestado(${a.id})">
        <div class="flex justify-between items-start gap-2">
          <div>
            <p class="text-xs font-black text-white capitalize">${a.tipo_atestado}</p>
            <p class="text-[10px] mt-0.5" style="color: rgba(148,163,184,0.6)">
              ${a.dias_afastamento ? a.dias_afastamento + ' dia(s) • ' : ''}
              ${new Date(a.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                style="background: ${a.status_atestado === 'emitido' ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.15)'};
                       color: ${a.status_atestado === 'emitido' ? 'var(--emerald)' : '#94a3b8'}">
            ${a.status_atestado}
          </span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="text-center py-4 text-xs text-red-400">Erro ao carregar</div>`;
  }
}

async function verDetalheAtestado(id) {
  try {
    const response = await fetch(`/api/atestados/detalhe/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const a = await response.json();

    if (!response.ok) {
      alert(a.erro || 'Erro ao carregar atestado');
      return;
    }

    let texto = `Atestado #${a.id} — ${a.status_atestado.toUpperCase()}\n\n`;
    texto += `Tipo: ${a.tipo_atestado}\n`;
    if (a.dias_afastamento) texto += `Dias: ${a.dias_afastamento}\n`;
    if (a.data_inicio) texto += `Início: ${a.data_inicio}\n`;
    if (a.data_fim) texto += `Fim: ${a.data_fim}\n`;
    if (a.cid) texto += `CID: ${a.cid}\n`;
    texto += `\nProfissional: ${a.profissional_nome}`;
    if (a.profissional_crm) texto += ` — CRM ${a.profissional_crm}/${a.profissional_uf_crm || ''}`;
    if (a.texto_livre) texto += `\n\n${a.texto_livre}`;

    alert(texto);
  } catch (err) {
    alert('Erro ao carregar detalhes do atestado.');
  }
}

// Integra com a função trocarAba
const _trocarAbaOriginal = window.trocarAba;
window.trocarAba = function (nomeAba) {
  _trocarAbaOriginal(nomeAba);

  if (nomeAba === 'receituario') {
    atualizarCrmReceita();
    const pid = document.getElementById('atendimentoPacienteId')?.value;
    if (pid) carregarHistoricoReceitas(pid);
  }

  if (nomeAba === 'atestado') {
    atualizarCrmAtestado();
    selecionarTipoAtestado('afastamento'); // reseta para o padrão
    const pid = document.getElementById('atendimentoPacienteId')?.value;
    if (pid) carregarHistoricoAtestados(pid);
  }
};
// =========================================================
// SOLICITAÇÃO DE EXAMES
// =========================================================
let catalogoExamesCompleto = {};
let examesSelecionados = [];
let filtroPacoteAtual = 'todos';

function atualizarCrmExame() {
  try {
    const tokenLocal = localStorage.getItem('token');
    if (!tokenLocal) return;
    const payload = JSON.parse(atob(tokenLocal.split('.')[1]));
    const el = document.getElementById('exameCrmInfo');
    if (el) {
      el.innerText = payload.crm
        ? (payload.uf_crm ? `CRM ${payload.crm}/${payload.uf_crm}` : `CRM ${payload.crm}`)
        : 'CRM não cadastrado';
    }
  } catch (e) { }
}

async function carregarCatalogoExames() {
  const container = document.getElementById('catalogoExamesContainer');
  if (!container) return;

  try {
    const response = await fetch('/api/solicitacoes-exames/catalogo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    catalogoExamesCompleto = data.exames || {};
    renderizarCatalogo();
  } catch (err) {
    console.error('Erro ao carregar catálogo:', err);
    container.innerHTML = `
      <div class="text-center py-10 text-xs text-red-400">
        Erro ao carregar catálogo de exames.
      </div>`;
  }
}

function filtrarPacoteExame(pacote) {
  filtroPacoteAtual = pacote;
  document.querySelectorAll('.pacote-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
  renderizarCatalogo();
}

function renderizarCatalogo() {
  const container = document.getElementById('catalogoExamesContainer');
  if (!container) return;

  const categorias = Object.keys(catalogoExamesCompleto);
  if (categorias.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-xs" style="color:rgba(148,163,184,0.4)">Catálogo vazio</div>`;
    return;
  }

  let html = '';

  categorias.forEach(categoria => {
    let exames = catalogoExamesCompleto[categoria];

    // Filtro por pacote
    if (filtroPacoteAtual !== 'todos') {
      exames = exames.filter(e => e.pacote_sugerido === filtroPacoteAtual);
    }

    if (exames.length === 0) return;

    html += `
      <div>
        <p class="form-label mb-2 flex items-center gap-1.5">
          <i class="fas fa-folder" style="color:var(--amber)"></i>
          ${categoria}
        </p>
        <div class="space-y-1.5">
          ${exames.map(exame => {
      const jaSelecionado = examesSelecionados.some(s => s.nome_exame === exame.nome_exame);
      return `
              <div class="exame-item glass-card p-2.5 flex items-center gap-3 cursor-pointer ${jaSelecionado ? 'selecionado' : ''}"
                   onclick="toggleExameSelecionado('${exame.categoria.replace(/'/g, "\\'")}', '${exame.nome_exame.replace(/'/g, "\\'")}', '${(exame.instrucoes_padrao || '').replace(/'/g, "\\'")}', '${exame.codigo_tuss || ''}')">
                <div class="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0"
                     style="border-color: ${jaSelecionado ? 'var(--emerald)' : 'rgba(148,163,184,0.3)'}; background: ${jaSelecionado ? 'rgba(52,211,153,0.2)' : 'transparent'}">
                  ${jaSelecionado ? '<i class="fas fa-check text-[10px]" style="color:var(--emerald)"></i>' : ''}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-white truncate">${exame.nome_exame}</p>
                  ${exame.instrucoes_padrao ? `<p class="text-[10px] truncate" style="color:rgba(148,163,184,0.55)">${exame.instrucoes_padrao}</p>` : ''}
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || `<div class="text-center py-10 text-xs" style="color:rgba(148,163,184,0.4)">Nenhum exame neste filtro</div>`;
}

function toggleExameSelecionado(categoria, nomeExame, instrucoes, codigoTuss) {
  const index = examesSelecionados.findIndex(e => e.nome_exame === nomeExame);

  if (index >= 0) {
    examesSelecionados.splice(index, 1);
  } else {
    examesSelecionados.push({
      categoria,
      nome_exame: nomeExame,
      instrucoes: instrucoes || null,
      codigo_tuss: codigoTuss || null
    });
  }

  renderizarCatalogo();
  renderizarExamesSelecionados();
}

function renderizarExamesSelecionados() {
  const container = document.getElementById('listaExamesSelecionados');
  const contador = document.getElementById('contadorExamesSelecionados');

  if (contador) contador.innerText = examesSelecionados.length;

  if (examesSelecionados.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8" style="color: rgba(148,163,184,0.35)">
        <i class="fas fa-vials text-2xl mb-2 block"></i>
        <p class="text-xs">Nenhum exame selecionado</p>
      </div>`;
    return;
  }

  container.innerHTML = examesSelecionados.map((ex, i) => `
    <div class="glass-card p-2.5 flex items-start gap-2">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-white truncate">${ex.nome_exame}</p>
        <p class="text-[10px]" style="color:rgba(148,163,184,0.55)">${ex.categoria}</p>
      </div>
      <button type="button" onclick="removerExameSelecionado(${i})" class="text-slate-500 hover:text-red-400 p-1">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
  `).join('');
}

function removerExameSelecionado(index) {
  examesSelecionados.splice(index, 1);
  renderizarCatalogo();
  renderizarExamesSelecionados();
}

async function emitirSolicitacaoExame(assinar) {
  const pacienteId = document.getElementById('atendimentoPacienteId')?.value;
  if (!pacienteId) {
    alert('Nenhum paciente selecionado.');
    return;
  }

  if (examesSelecionados.length === 0) {
    alert('Selecione pelo menos um exame.');
    return;
  }

  if (assinar) {
    const original = window.confirmarAssinatura;
    window.confirmarAssinatura = async function (e) {
      if (e) e.preventDefault();
      const senha = document.getElementById('senhaAssinatura').value;
      if (!senha) {
        document.getElementById('erroSenhaAssinatura').innerText = 'Digite sua senha.';
        document.getElementById('erroSenhaAssinatura').classList.remove('hidden');
        return;
      }
      fecharModalAssinatura();
      window.confirmarAssinatura = original;
      await salvarSolicitacaoNoBackend(true, senha);
    };
    abrirModalAssinatura();
  } else {
    await salvarSolicitacaoNoBackend(false, null);
  }
}

async function salvarSolicitacaoNoBackend(assinar, senha) {
  const pacienteId = document.getElementById('atendimentoPacienteId').value;
  const agendamentoId = document.getElementById('atendimentoAgendamentoId')?.value || null;

  const payload = {
    pacienteId: parseInt(pacienteId),
    agendamentoId: agendamentoId ? parseInt(agendamentoId) : null,
    titulo: document.getElementById('exameTitulo').value.trim() || null,
    observacoes: document.getElementById('exameObservacoes').value.trim() || null,
    prioridade: document.getElementById('examePrioridade').value || 'rotina',
    itens: examesSelecionados,
    apenasRascunho: !assinar,
    senhaAssinatura: senha || undefined
  };

  try {
    const response = await fetch('/api/solicitacoes-exames/salvar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      alert(assinar ? '✅ Solicitação de exames emitida e assinada!' : '✅ Rascunho salvo com sucesso!');
      if (assinar && data.solicitacaoId) {
        ultimaSolicitacaoEmitidaId = data.solicitacaoId;
      }
      examesSelecionados = [];
      renderizarExamesSelecionados();
      renderizarCatalogo();
      document.getElementById('exameTitulo').value = '';
      document.getElementById('exameObservacoes').value = '';
      document.getElementById('examePrioridade').value = 'rotina';
    } else {
      alert(data.erro || 'Erro ao salvar solicitação.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao salvar solicitação.');
  }
}

// =========================================================
// ENVIO DE E-MAILS (Receita / Atestado / Exames)
// =========================================================

let ultimaReceitaEmitidaId = null;
let ultimoAtestadoEmitidoId = null;
let ultimaSolicitacaoEmitidaId = null;

async function enviarReceitaEmail() {
  if (!ultimaReceitaEmitidaId) {
    alert('Emita uma receita primeiro para poder enviá-la por e-mail.');
    return;
  }

  const btn = document.getElementById('btnEnviarReceitaEmail');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const response = await fetch('/api/receitas/enviar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ receitaId: ultimaReceitaEmitidaId })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Receita enviada por e-mail com sucesso!');
    } else {
      alert(data.erro || 'Erro ao enviar e-mail da receita.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao enviar e-mail.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por E-mail';
  }
}

async function enviarAtestadoEmail() {
  if (!ultimoAtestadoEmitidoId) {
    alert('Emita um atestado primeiro para poder enviá-lo por e-mail.');
    return;
  }

  const btn = document.getElementById('btnEnviarAtestadoEmail');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const response = await fetch('/api/atestados/enviar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ atestadoId: ultimoAtestadoEmitidoId })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Atestado enviado por e-mail com sucesso!');
    } else {
      alert(data.erro || 'Erro ao enviar e-mail do atestado.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao enviar e-mail.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por E-mail';
  }
}

async function enviarExamesEmail() {
  if (!ultimaSolicitacaoEmitidaId) {
    alert('Emita uma solicitação de exames primeiro para poder enviá-la por e-mail.');
    return;
  }

  const btn = document.getElementById('btnEnviarExamesEmail');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const response = await fetch('/api/solicitacoes-exames/enviar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ solicitacaoId: ultimaSolicitacaoEmitidaId })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Solicitação de exames enviada por e-mail com sucesso!');
    } else {
      alert(data.erro || 'Erro ao enviar e-mail da solicitação.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao enviar e-mail.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por E-mail';
  }
}

// Integração final com trocarAba
const __trocarAbaOriginal = window.trocarAba;
window.trocarAba = function (nomeAba) {
  __trocarAbaOriginal(nomeAba);

  if (nomeAba === 'receituario') {
    atualizarCrmReceita();
    const pid = document.getElementById('atendimentoPacienteId')?.value;
    if (pid) carregarHistoricoReceitas(pid);
  }

  if (nomeAba === 'atestado') {
    atualizarCrmAtestado();
    selecionarTipoAtestado('afastamento');
    const pid = document.getElementById('atendimentoPacienteId')?.value;
    if (pid) carregarHistoricoAtestados(pid);
  }

  if (nomeAba === 'exames') {
    atualizarCrmExame();
    carregarCatalogoExames();
  }

  if (nomeAba === 'anamnese') {
    const pid = document.getElementById('atendimentoPacienteId')?.value;
    if (pid && typeof carregarHistoricoAnamneses === 'function') {
      carregarHistoricoAnamneses(pid);
    }
  }
};

// Exports
window.filtrarPacoteExame = filtrarPacoteExame;
window.toggleExameSelecionado = toggleExameSelecionado;
window.removerExameSelecionado = removerExameSelecionado;
window.emitirSolicitacaoExame = emitirSolicitacaoExame;

// Exports
window.selecionarTipoAtestado = selecionarTipoAtestado;
window.emitirAtestado = emitirAtestado;
window.verDetalheAtestado = verDetalheAtestado;

window.adicionarMedicamento = adicionarMedicamento;
window.removerMedicamento = removerMedicamento;
window.emitirReceita = emitirReceita;
window.verDetalheReceita = verDetalheReceita;

// Chama o CRM e o histórico da receita quando a aba for aberta
// (precisa vir depois de "window.trocarAba = trocarAba" acima, senão seria sobrescrito)
const originalTrocarAba = window.trocarAba;
window.trocarAba = function (nomeAba) {
  originalTrocarAba(nomeAba);
  if (nomeAba === 'receituario') {
    atualizarCrmReceita();
    const pacienteId = document.getElementById('atendimentoPacienteId')?.value;
    if (pacienteId) carregarHistoricoReceitas(pacienteId);
  }
};

window.enviarReceitaEmail = enviarReceitaEmail;
window.enviarAtestadoEmail = enviarAtestadoEmail;
window.enviarExamesEmail = enviarExamesEmail;