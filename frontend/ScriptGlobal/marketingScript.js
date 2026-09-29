// ScriptGlobal/marketingScript.js
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        space: ['Space Grotesk', 'sans-serif']
      }
    }
  }
};

const token = localStorage.getItem('token');
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
};

// ─── Estado global ───
let pacientesSelecionados = [];
let paginaAtual = 1;
let debounceTimer = null;
let filtroStatusAtual = '';

// ─── Modais de feedback (UX moderna) ───
function mostrarModal({ tipo = 'info', titulo, mensagem, botaoTexto = 'Entendi', onConfirm }) {
  const existente = document.getElementById('modalFeedbackMedLM');
  if (existente) existente.remove();

  const cores = {
    sucesso: { icon: 'fa-check-circle', cor: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'from-emerald-500/20' },
    erro:    { icon: 'fa-times-circle',  cor: 'text-red-400',     border: 'border-red-500/40',     bg: 'from-red-500/20' },
    aviso:   { icon: 'fa-exclamation-triangle', cor: 'text-amber-400', border: 'border-amber-500/40', bg: 'from-amber-500/20' },
    info:    { icon: 'fa-info-circle',   cor: 'text-cyan-400',    border: 'border-cyan-500/40',    bg: 'from-cyan-500/20' }
  };
  const c = cores[tipo] || cores.info;

  const modal = document.createElement('div');
  modal.id = 'modalFeedbackMedLM';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md';
  modal.innerHTML = `
    <div class="cyber-panel rounded-2xl p-6 max-w-md w-full border ${c.border} relative">
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${c.bg} to-transparent flex items-center justify-center flex-shrink-0">
          <i class="fas ${c.icon} ${c.cor} text-xl"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-black text-white font-['Space_Grotesk'] mb-1">${titulo}</h3>
          <p class="text-sm text-slate-300 leading-relaxed">${mensagem}</p>
        </div>
      </div>
      <button id="btnModalOk" class="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition">
        ${botaoTexto}
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnModalOk').onclick = () => {
    modal.remove();
    if (typeof onConfirm === 'function') onConfirm();
  };

  const fecharEsc = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', fecharEsc);
    }
  };
  document.addEventListener('keydown', fecharEsc);
}

// ─── Créditos WhatsApp ───
async function carregarDadosCreditosWhatsApp() {
  try {
    const res = await fetch('/api/marketing/creditos-whatsapp', { headers });
    if (!res.ok) return;
    const data = await res.json();

    const saldo = data.whatsapp_creditos || 0;
    const totalComprado = data.total_comprado_mes || 0;

    const elSaldo = document.getElementById('saldoCreditosDisplay');
    const elTotal = document.getElementById('totalCompradoDisplay');
    const elGarantidas = document.getElementById('mensagensGarantidasDisplay');
    if (elSaldo) elSaldo.textContent = saldo;
    if (elTotal) elTotal.textContent = `${totalComprado} créditos`;
    if (elGarantidas) elGarantidas.textContent = `${saldo} disparos`;

    const banner = document.getElementById('bannerAlertaCreditos');
    const textoAlerta = document.getElementById('textoAlertaCreditos');
    if (!banner || !textoAlerta) return;

    if (saldo === 0) {
      banner.classList.remove('hidden');
      banner.className = 'mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between gap-3';
      textoAlerta.innerHTML = `<i class="fas fa-ban text-red-400 text-base"></i> Seus créditos de WhatsApp esgotaram! Faça uma recarga para continuar.`;
    } else if (saldo < 50) {
      banner.classList.remove('hidden');
      banner.className = 'mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between gap-3';
      textoAlerta.innerHTML = `<i class="fas fa-triangle-exclamation text-amber-400 text-base"></i> Atenção: restam apenas <strong>${saldo} créditos</strong> de WhatsApp.`;
    } else {
      banner.classList.add('hidden');
    }
  } catch (err) {
    console.error('Erro ao carregar créditos:', err);
  }
}

async function comprarCreditosWhatsApp(pacote) {
  if (!confirm(`Deseja comprar o pacote de ${pacote} disparos de WhatsApp?`)) return;

  try {
    const res = await fetch('/api/pagamentos/criar-preferencia', {
      method: 'POST',
      headers,
      body: JSON.stringify({ pacote })
    });
    const data = await res.json();

    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      mostrarModal({ tipo: 'erro', titulo: 'Erro no pagamento', mensagem: data.erro || 'Não foi possível gerar o link de pagamento.' });
    }
  } catch (err) {
    mostrarModal({ tipo: 'erro', titulo: 'Falha de conexão', mensagem: 'Não foi possível conectar ao gateway de pagamento.' });
  }
}

// ─── Contador de público ───
async function atualizarContadorPublico() {
  const el = document.getElementById('contadorPublico');
  if (!el) return;

  el.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-cyan-400"></i> Calculando público-alvo...';

  try {
    const tipo = document.querySelector('input[name="tipoPublico"]:checked')?.value || 'todos';
    const canal = document.querySelector('input[name="canalEnvio"]:checked')?.value || 'email';
    let url = `/api/marketing/publico-alvo?tipoPublico=${tipo}&canal=${canal}`;

    if (tipo === 'individual') {
      const ids = pacientesSelecionados.map(p => p.id);
      url += `&pacienteIds=${JSON.stringify(ids)}`;
    } else if (tipo === 'filtro') {
      const filtro = document.querySelector('input[name="tipoPublico"]:checked')?.dataset.filtro;
      if (filtro) url += `&filtro=${JSON.stringify({ tipo: filtro })}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();
    el.innerHTML = `<i class="fas fa-users mr-1 text-cyan-400"></i> Enviando para <strong class="text-emerald-400">${data.total || 0}</strong> paciente(s)`;
  } catch (err) {
    el.textContent = 'Não foi possível calcular o público-alvo.';
  }
}

// ─── Histórico de campanhas ───
function filtrarCampanhas(status) {
  filtroStatusAtual = status || '';
  document.querySelectorAll('.filtro-status-btn').forEach((btn) => {
    const ativo = (btn.getAttribute('data-filtro-status') || '') === filtroStatusAtual;
    btn.classList.toggle('active', ativo);
  });
  carregarCampanhas(1, filtroStatusAtual);
}

async function carregarCampanhas(pagina = 1, status = filtroStatusAtual) {
  const el = document.getElementById('listaCampanhas');
  if (!el) return;

  el.innerHTML = '<tr><td colspan="5" class="py-6 px-6 text-center text-slate-500">Carregando...</td></tr>';

  try {
    const params = new URLSearchParams({ pagina, porPagina: 10 });
    if (status) params.set('status', status);

    const res = await fetch(`/api/marketing/campanhas?${params}`, { headers });
    const data = await res.json();
    paginaAtual = data.pagina || 1;

    if (!data.campanhas?.length) {
      el.innerHTML = '<tr><td colspan="5" class="py-6 px-6 text-center text-slate-500">Nenhuma campanha encontrada.</td></tr>';
      return;
    }

    el.innerHTML = data.campanhas.map(c => {
      const pct = c.total_destinatarios ? Math.round((c.total_enviados / c.total_destinatarios) * 100) : 0;
      const statusClass = `badge-${c.status}`;
      const canalLabel = c.canal === 'whatsapp' ? 'WhatsApp' : (c.assunto || 'E-mail');
      return `
        <tr>
          <td class="py-3.5 px-4 sm:px-6">
            <span class="block text-slate-200 font-bold">${c.titulo}</span>
            <span class="text-[10px] text-slate-500">${canalLabel}</span>
          </td>
          <td class="py-3.5 px-4 sm:px-6 text-slate-400">${c.tipo_publico}</td>
          <td class="py-3.5 px-4 sm:px-6"><span class="badge-status ${statusClass}">${c.status.replace(/_/g, ' ')}</span></td>
          <td class="py-3.5 px-4 sm:px-6">
            <div class="flex items-center gap-2">
              <div class="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-400" style="width:${pct}%"></div>
              </div>
              <span class="text-[10px] text-slate-500">${c.total_enviados}/${c.total_destinatarios}</span>
            </div>
          </td>
          <td class="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">${new Date(c.criado_em).toLocaleString('pt-BR')}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    el.innerHTML = '<tr><td colspan="5" class="py-6 px-6 text-center text-red-400">Erro ao carregar campanhas.</td></tr>';
  }
}

// ─── Preview ───
function atualizarPreview() {
  const corpoEl = document.getElementById('campoCorpo');
  const assuntoEl = document.getElementById('campoAssunto');
  const previewCorpoEl = document.getElementById('previewCorpo');
  const previewAssuntoEl = document.getElementById('previewAssunto');

  if (!corpoEl || !previewCorpoEl) return;

  const corpo = corpoEl.innerHTML.trim() || '<span style="color:#94a3b8">Comece a escrever sua mensagem...</span>';
  const assunto = assuntoEl?.value.trim() || '(sem assunto)';

  previewCorpoEl.innerHTML = corpo.replace(/{{\s*nome_paciente\s*}}/gi, '<strong>Maria</strong>');
  if (previewAssuntoEl) previewAssuntoEl.textContent = assunto;
}

// ─── Formatação do editor ───
function formatarTexto(comando) {
  document.execCommand(comando, false, null);
  document.getElementById('campoCorpo')?.focus();
  atualizarPreview();
}

function inserirLink() {
  const url = prompt('Digite a URL do link:');
  if (url) {
    document.execCommand('createLink', false, url);
    atualizarPreview();
  }
}

function inserirVariavel(variavel) {
  const el = document.getElementById('campoCorpo');
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, variavel);
  atualizarPreview();
}

// ─── Templates rápidos ───
const TEMPLATES = {
  lembrete: {
    titulo: 'Lembrete de consulta',
    assunto: 'Lembrete: sua consulta está próxima',
    corpo: 'Olá {{nome_paciente}},<br><br>Passando para lembrar da sua consulta agendada. Por favor, confirme sua presença respondendo esta mensagem.<br><br>Atenciosamente,<br>Equipe da Clínica'
  },
  feriado: {
    titulo: 'Aviso de feriado / recesso',
    assunto: 'Estaremos em recesso',
    corpo: 'Olá {{nome_paciente}},<br><br>Informamos que a clínica estará em recesso no período de [DATA]. Retornaremos normalmente em [DATA].<br><br>Em caso de urgência, entre em contato pelo telefone de plantão.<br><br>Atenciosamente'
  },
  promocao: {
    titulo: 'Campanha promocional',
    assunto: 'Condição especial para você!',
    corpo: 'Olá {{nome_paciente}},<br><br>Temos uma condição especial preparada especialmente para você! Aproveite enquanto durar.<br><br>Agende agora e garanta seu horário.'
  },
  aniversario: {
    titulo: 'Feliz aniversário',
    assunto: 'Feliz aniversário!',
    corpo: 'Olá {{nome_paciente}},<br><br>A equipe da clínica deseja um feliz aniversário repleto de saúde e alegria!<br><br>Com carinho'
  },
  retorno: {
    titulo: 'Convite de retorno',
    assunto: 'Que tal um retorno?',
    corpo: 'Olá {{nome_paciente}},<br><br>Faz um tempo que não nos vemos. Que tal agendar um retorno para cuidarmos da sua saúde?<br><br>Estamos à disposição!'
  }
};

document.querySelectorAll('.template-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const key = chip.dataset.template;
    if (!key) {
      document.getElementById('campoTitulo').value = '';
      document.getElementById('campoAssunto').value = '';
      document.getElementById('campoCorpo').innerHTML = '';
    } else if (TEMPLATES[key]) {
      const t = TEMPLATES[key];
      document.getElementById('campoTitulo').value = t.titulo;
      document.getElementById('campoAssunto').value = t.assunto;
      document.getElementById('campoCorpo').innerHTML = t.corpo;
    }
    atualizarPreview();
    const contador = document.getElementById('contadorAssunto');
    if (contador) contador.textContent = (document.getElementById('campoAssunto').value.length) + '/60';
  });
});

// ─── Público-alvo (radio) ───
document.querySelectorAll('input[name="tipoPublico"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.radio-audience').forEach(l => l.classList.remove('selected'));
    radio.closest('.radio-audience')?.classList.add('selected');

    const area = document.getElementById('areaPacientesEspecificos');
    if (radio.value === 'individual') {
      area?.classList.remove('hidden');
    } else {
      area?.classList.add('hidden');
    }
    atualizarContadorPublico();
  });
});

// ─── Autocomplete de pacientes ───
const inputBusca = document.getElementById('campoBuscaPaciente');
const listaAutocomplete = document.getElementById('autocompleteLista');

async function buscarPacientes(termo = '') {
  try {
    const res = await fetch(`/api/marketing/pacientes/buscar?q=${encodeURIComponent(termo)}`, { headers });
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar pacientes:', err);
    return [];
  }
}

function renderAutocomplete(pacientes) {
  if (!listaAutocomplete) return;

  if (!pacientes.length) {
    listaAutocomplete.innerHTML = '<div class="autocomplete-vazio">Nenhum paciente encontrado</div>';
    listaAutocomplete.classList.add('open');
    return;
  }

  listaAutocomplete.innerHTML = pacientes.map(p => `
    <div class="autocomplete-item" data-id="${p.id}">
      <div class="avatar">${(p.nome || '?').charAt(0).toUpperCase()}</div>
      <div class="info">
        <span class="nome">${p.nome}</span>
        <span class="cpf">${p.telefone || p.email || p.cpf || 'Sem contato'}</span>
      </div>
    </div>
  `).join('');

  listaAutocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      const paciente = pacientes.find(p => p.id === id);
      if (paciente) selecionarPaciente(paciente);
    });
  });

  listaAutocomplete.classList.add('open');
}

function selecionarPaciente(paciente) {
  if (pacientesSelecionados.some(p => p.id === paciente.id)) return;

  pacientesSelecionados.push(paciente);
  renderChipsPacientes();
  atualizarContadorPublico();

  if (inputBusca) inputBusca.value = '';
  listaAutocomplete?.classList.remove('open');
}

function removerPaciente(id) {
  pacientesSelecionados = pacientesSelecionados.filter(p => p.id !== id);
  renderChipsPacientes();
  atualizarContadorPublico();
}

function renderChipsPacientes() {
  const container = document.getElementById('listaPacientesSelecionados');
  if (!container) return;

  container.innerHTML = pacientesSelecionados.map(p => `
    <span class="chip-paciente">
      ${p.nome}
      <button type="button" onclick="removerPaciente(${p.id})" title="Remover">
        <i class="fas fa-times"></i>
      </button>
    </span>
  `).join('');
}

window.removerPaciente = removerPaciente;

if (inputBusca) {
  inputBusca.addEventListener('focus', async () => {
    const pacientes = await buscarPacientes('');
    renderAutocomplete(pacientes);
  });

  inputBusca.addEventListener('input', async (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const pacientes = await buscarPacientes(e.target.value);
      renderAutocomplete(pacientes);
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrap')) {
      listaAutocomplete?.classList.remove('open');
    }
  });
}

// ─── Canal de envio ───
function alternarCanalEnvio() {
  const canal = document.querySelector('input[name="canalEnvio"]:checked')?.value || 'email';
  const assuntoWrap = document.getElementById('campoAssunto')?.closest('div');

  if (canal === 'whatsapp') {
    if (assuntoWrap) assuntoWrap.style.display = 'none';
  } else {
    if (assuntoWrap) assuntoWrap.style.display = 'block';
  }
  atualizarContadorPublico();
  atualizarPreview();
}

// ─── Enviar / Salvar campanha ───
async function enviarCampanha(rascunho = false) {
  const titulo = document.getElementById('campoTitulo')?.value.trim();
  const assunto = document.getElementById('campoAssunto')?.value.trim();
  const corpoHtml = document.getElementById('campoCorpo')?.innerHTML.trim();
  const canal = document.querySelector('input[name="canalEnvio"]:checked')?.value || 'email';
  const tipoPublico = document.querySelector('input[name="tipoPublico"]:checked')?.value || 'todos';

  if (!titulo || !corpoHtml) {
    mostrarModal({ tipo: 'aviso', titulo: 'Campos obrigatórios', mensagem: 'Preencha o título e a mensagem da campanha.' });
    return;
  }
  if (canal === 'email' && !assunto) {
    mostrarModal({ tipo: 'aviso', titulo: 'Assunto obrigatório', mensagem: 'Informe o assunto do e-mail.' });
    return;
  }

  const opcoesPublico = {};
  if (tipoPublico === 'individual') {
    if (!pacientesSelecionados.length) {
      mostrarModal({ tipo: 'aviso', titulo: 'Nenhum paciente selecionado', mensagem: 'Selecione ao menos um paciente específico.' });
      return;
    }
    opcoesPublico.pacienteIds = pacientesSelecionados.map(p => p.id);
  } else if (tipoPublico === 'filtro') {
    const filtro = document.querySelector('input[name="tipoPublico"]:checked')?.dataset.filtro;
    if (filtro) opcoesPublico.filtro = { tipo: filtro };
  }

  const btn = document.getElementById('btnEnviarCampanha');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  try {
    const res = await fetch('/api/marketing/campanhas', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        titulo,
        assunto: assunto || '',
        corpoHtml,
        tipoPublico,
        opcoesPublico,
        canal,
        rascunho
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.codigo === 'CREDITOS_INSUFICIENTES' || res.status === 402) {
        mostrarModal({
          tipo: 'aviso',
          titulo: 'Créditos insuficientes',
          mensagem: data.erro || 'Você não possui créditos de WhatsApp suficientes. Faça uma recarga.',
          botaoTexto: 'Ver pacotes'
        });
      } else {
        mostrarModal({ tipo: 'erro', titulo: 'Erro ao criar campanha', mensagem: data.erro || 'Tente novamente.' });
      }
      return;
    }

    mostrarModal({
      tipo: 'sucesso',
      titulo: rascunho ? 'Rascunho salvo!' : 'Campanha enviada!',
      mensagem: rascunho
        ? 'O rascunho foi salvo com sucesso.'
        : `Campanha criada e enviada para ${data.totalDestinatarios} paciente(s) via ${canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}.`,
      onConfirm: () => {
        document.getElementById('campoTitulo').value = '';
        document.getElementById('campoAssunto').value = '';
        document.getElementById('campoCorpo').innerHTML = '';
        pacientesSelecionados = [];
        renderChipsPacientes();
        atualizarPreview();
        carregarCampanhas(1);
        carregarDadosCreditosWhatsApp();
      }
    });
  } catch (err) {
    mostrarModal({ tipo: 'erro', titulo: 'Falha de comunicação', mensagem: 'Não foi possível conectar ao servidor.' });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar campanha';
    }
  }
}

// ─── WhatsApp Instance ───
async function conectarWhatsAppInstance() {
  const modal = document.getElementById('modalQrCode');
  const container = document.getElementById('qrCodeContainer');
  if (!modal || !container) return;

  modal.classList.remove('hidden');
  container.innerHTML = '<span class="text-slate-800 text-xs font-semibold animate-pulse">Solicitando QR Code...</span>';
  if (typeof atualizarVisualStatusWhatsApp === 'function') atualizarVisualStatusWhatsApp('connecting');

  try {
    const res = await fetch('/api/marketing/whatsapp/conectar', { headers });
    const data = await res.json();

    if (!res.ok) {
      container.innerHTML = `<p class="text-xs text-red-500 font-semibold px-2">${data.erro || 'Erro ao gerar QR Code.'}</p>`;
      return;
    }

    if (data.instanceName) {
      const el = document.getElementById('instanciaNomeDisplay');
      if (el) el.textContent = data.instanceName;
    }
    if (data.telefone) {
      const el = document.getElementById('telefoneClinicaDisplay');
      if (el) el.textContent = data.telefone;
    }

    if (data.qrcode) {
      const src = data.qrcode.startsWith('data:') ? data.qrcode : `data:image/png;base64,${data.qrcode}`;
      container.innerHTML = `<img src="${src}" alt="QR Code WhatsApp" class="w-48 h-48 object-contain mx-auto">`;
      if (typeof atualizarVisualStatusWhatsApp === 'function') atualizarVisualStatusWhatsApp('connecting', data.telefone);
    } else if (data.status === 'open') {
      container.innerHTML = '<p class="text-xs text-emerald-600 font-bold">Instância já conectada!</p>';
      if (typeof atualizarVisualStatusWhatsApp === 'function') atualizarVisualStatusWhatsApp('open', data.telefone);
    } else {
      container.innerHTML = '<p class="text-xs text-amber-600 font-semibold px-2">Nenhum QR Code retornado. Tente novamente em alguns segundos.</p>';
      if (typeof atualizarVisualStatusWhatsApp === 'function') atualizarVisualStatusWhatsApp(data.status || 'close', data.telefone);
    }
  } catch (e) {
    console.error('[WHATSAPP] Erro:', e);
    container.innerHTML = '<p class="text-xs text-red-500 font-semibold">Erro ao comunicar com a Evolution API.</p>';
    if (typeof atualizarVisualStatusWhatsApp === 'function') atualizarVisualStatusWhatsApp('close');
  }
}

function fecharModalQrCode() {
  document.getElementById('modalQrCode')?.classList.add('hidden');
}

/**
 * Atualiza o visual neon do status da instância WhatsApp.
 * @param {'open'|'connecting'|'close'|string} status
 * @param {string|null} telefone
 */
function atualizarVisualStatusWhatsApp(status, telefone = null) {
  const badge = document.getElementById('waStatusBadge');
  const label = document.getElementById('waStatusLabel');
  const subtitle = document.getElementById('waStatusSubtitle');
  const estadoEl = document.getElementById('waEstadoDisplay');
  const indicator = document.getElementById('statusIndicatorInstance');

  if (!badge || !label) return;

  badge.classList.remove('wa-status-connected', 'wa-status-disconnected', 'wa-status-connecting');
  const st = (status || '').toLowerCase();

  if (st === 'open') {
    badge.classList.add('wa-status-connected');
    label.innerHTML = telefone
      ? `WhatsApp Conectado e Operacional <span class="wa-status-phone opacity-90">· ${telefone}</span>`
      : 'WhatsApp Conectado e Operacional';
    if (subtitle) {
      subtitle.className = 'wa-status-subtitle text-emerald-300/90';
      subtitle.innerHTML = 'Sessão ativa. Disparos automáticos e lembretes de consultas estão <strong>habilitados</strong>.';
    }
    if (estadoEl) estadoEl.textContent = 'open';
    if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
  } else if (st === 'connecting' || st === 'created') {
    badge.classList.add('wa-status-connecting');
    label.textContent = 'Conectando… aguarde a leitura do QR Code';
    if (subtitle) {
      subtitle.className = 'wa-status-subtitle text-cyan-300/90';
      subtitle.innerHTML = 'Escaneie o QR Code no celular da clínica. Os disparos ficam pausados até a conexão ser estabelecida.';
    }
    if (estadoEl) estadoEl.textContent = st;
    if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse';
  } else {
    badge.classList.add('wa-status-disconnected');
    label.textContent = 'WhatsApp Desconectado — Necessário Conectar';
    if (subtitle) {
      subtitle.className = 'wa-status-subtitle text-amber-200/90';
      subtitle.innerHTML = 'Disparos automáticos e lembretes de consultas estão <strong>pausados</strong> até que o QR Code seja lido.';
    }
    if (estadoEl) estadoEl.textContent = st || 'desconectado';
    if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
  }

  if (telefone) {
    const telEl = document.getElementById('telefoneClinicaDisplay');
    if (telEl) telEl.textContent = telefone;
  }
}

async function carregarDadosInstanciaWhatsApp() {
  try {
    atualizarVisualStatusWhatsApp('connecting');

    const res = await fetch('/api/marketing/whatsapp/conectar', { headers });
    if (!res.ok) {
      atualizarVisualStatusWhatsApp('close');
      return;
    }
    const data = await res.json();

    if (data.instanceName) {
      const el = document.getElementById('instanciaNomeDisplay');
      if (el) el.textContent = data.instanceName;
    }
    if (data.telefone) {
      const el = document.getElementById('telefoneClinicaDisplay');
      if (el) el.textContent = data.telefone;
    }

    const status = data.status || (data.qrcode ? 'connecting' : 'close');
    atualizarVisualStatusWhatsApp(status, data.telefone || null);
  } catch (err) {
    console.error('Erro ao carregar dados da instância:', err);
    atualizarVisualStatusWhatsApp('close');
  }
}

// ─── Scroll progress + drawer mobile ───
(function () {
  'use strict';
  var progressBar = document.getElementById('scroll-progress');
  function atualizarProgresso() {
    if (!progressBar) return;
    var alturaTotal = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    var percentual = alturaTotal > 0 ? (window.scrollY / alturaTotal) * 100 : 0;
    progressBar.style.width = percentual + '%';
  }

  var btnAbrir = document.getElementById('btnOpenDrawer');
  var btnFechar = document.getElementById('btnCloseDrawer');
  var overlay = document.getElementById('drawerOverlay');
  var drawer = document.getElementById('mobileDrawer');

  function abrirDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function fecharDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (btnAbrir) btnAbrir.addEventListener('click', abrirDrawer);
  if (btnFechar) btnFechar.addEventListener('click', fecharDrawer);
  if (overlay) overlay.addEventListener('click', fecharDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDrawer(); });
  if (drawer) {
    drawer.querySelectorAll('a.nav-item').forEach(link => link.addEventListener('click', fecharDrawer));
  }

  var topbar = document.querySelector('.mobile-topbar');
  var tabbar = document.querySelector('.mobile-bottom-tabbar');
  var scrollStopTimer = null;
  var ultimoScrollY = window.scrollY;

  function aoRolar() {
    atualizarProgresso();
    var deltaY = window.scrollY - ultimoScrollY;
    ultimoScrollY = window.scrollY;
    if (window.innerWidth < 1024 && Math.abs(deltaY) > 2) {
      if (tabbar) tabbar.classList.add('tabbar-hidden');
      if (topbar) topbar.classList.add('topbar-hidden');
    }
    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(() => {
      if (tabbar) tabbar.classList.remove('tabbar-hidden');
      if (topbar) topbar.classList.remove('topbar-hidden');
    }, 600);
  }

  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', atualizarProgresso);
  atualizarProgresso();
})();

// ─── Inicialização ───
document.addEventListener('DOMContentLoaded', () => {
  carregarDadosCreditosWhatsApp();
  carregarDadosInstanciaWhatsApp();
  atualizarContadorPublico();
  carregarCampanhas(1);
  atualizarPreview();

  document.getElementById('btnEnviarCampanha')?.addEventListener('click', () => enviarCampanha(false));
  document.getElementById('btnSalvarRascunho')?.addEventListener('click', () => enviarCampanha(true));

  const campoAssunto = document.getElementById('campoAssunto');
  if (campoAssunto) {
    campoAssunto.addEventListener('input', atualizarPreview);
  }
});
