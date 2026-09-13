/* =============================================================================
   AgendaAvancadaScript.js  — MedLM Agenda Avançada (v3 turbinada)
   Camada 1: Profissionais | 2: Ano | 3: Mês | 4: Grade

   Correções v2 + Features de mercado v3:
   - Datas LOCAL (sem NaN / shift UTC)
   - Grade sempre sincronizada + sem colunas duplicadas
   - Duração real dos blocos (duracao_minutos ou mapa por tipo)
   - Snap de 15 minutos no drag-and-drop
   - Filtros por status e origem
   - Validação de conflito no cliente + feedback
   - Indicador de ocupação do dia
   - Atalhos de teclado (T=hoje, N=novo, setas, Esc)
   - Troca rápida de profissional sem sair da grade
   ============================================================================= */
(function () {
  'use strict';

  const API = '/api/agenda-avancada';
  const token = localStorage.getItem('token');
  const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const HORA_ALTURA = 120; // ~2x — mais espaço para informação
  const COL_LARGURA = 160;
  const SNAP_MINUTOS = 15;           // snap de mercado
  const DURACAO_PADRAO = 50;         // minutos (padrão clínica)

  const COL_LARGURA_SUB = 120;
  const CORES_PROF = [
    { bg: '#bfdbfe', border: '#2563eb' },
    { bg: '#bbf7d0', border: '#059669' },
    { bg: '#fed7aa', border: '#d97706' },
    { bg: '#ddd6fe', border: '#7c3aed' },
    { bg: '#fbcfe8', border: '#db2777' },
    { bg: '#a5f3fc', border: '#0891b2' }
  ];

  // Duração por tipo de terapia (ajuste conforme sua clínica)
  const DURACAO_POR_TIPO = {
    'psicoterapia': 50,
    'retorno': 30,
    'avaliação': 60,
    'avaliacao': 60,
    'fisioterapia': 45,
    'nutrição': 40,
    'nutricao': 40,
    'fonoaudiologia': 45,
    'consulta': 30
  };

  const state = {
    profissional: null,
    profissionais: [],
    modoMulti: false,
    profissionaisVisiveis: [],  // ids no modo multi
    ano: new Date().getFullYear(),
    mesAtual: { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 },
    colunas: [],
    agendamentosPorDia: {},
    carregandoMais: false,
    contextoAtual: null,
    diaSelecionado: null,
    filtros: {
      status: 'todos',
      origem: 'todos'
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }

  async function authFetch(url, opts = {}) {
    opts.headers = Object.assign({}, opts.headers, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    const res = await fetch(url, opts);
    if (res.status === 401) {
      mostrarToast('Sessão expirada. Faça login novamente.', 'error');
      throw new Error('401');
    }
    return res;
  }

  function mostrarToast(msg, tipo = 'success') {
    const toast = $('#toast');
    if (!toast) return;
    const icon = toast.querySelector('i');
    const icones = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    toast.className = `toast show ${tipo}`;
    if (icon) icon.className = `fas ${icones[tipo] || icones.success}`;
    const msgEl = $('#toastMsg');
    if (msgEl) msgEl.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function formatarDataISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function parseLocalDate(valor) {
    if (valor instanceof Date && !isNaN(valor.getTime())) return new Date(valor.getTime());
    if (typeof valor !== 'string') return new Date(NaN);
    const match = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return new Date(NaN);
    const [, y, m, d, h = '0', min = '0', s = '0'] = match;
    return new Date(+y, +m - 1, +d, +h, +min, +s);
  }

  function inicioDaSemana(data) {
    const d = parseLocalDate(data);
    if (isNaN(d.getTime())) return new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function somarDias(data, n) {
    const d = parseLocalDate(data);
    if (isNaN(d.getTime())) return new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  function ehHoje(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return false;
    const h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate();
  }

  function corPastel(idx) {
    return ['cor-azul', 'cor-verde', 'cor-laranja', 'cor-roxo'][idx % 4];
  }

  function iniciais(nome) {
    return (nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /** Duração em minutos: campo explícito > mapa por tipo > padrão */
  function obterDuracaoMinutos(a) {
    if (a && a.duracao_minutos && Number(a.duracao_minutos) > 0) return Number(a.duracao_minutos);
    const tipo = (a && a.tipo_terapia || '').toLowerCase().trim();
    if (tipo && DURACAO_POR_TIPO[tipo] != null) return DURACAO_POR_TIPO[tipo];
    // match parcial
    for (const key of Object.keys(DURACAO_POR_TIPO)) {
      if (tipo.includes(key)) return DURACAO_POR_TIPO[key];
    }
    return DURACAO_PADRAO;
  }

  /** Snap para o intervalo mais próximo (15 min) */
  function snapMinutos(minutosTotais) {
    return Math.round(minutosTotais / SNAP_MINUTOS) * SNAP_MINUTOS;
  }

  function minutosParaHoraStr(minutos) {
    const h = Math.floor(minutos / 60) % 24;
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Verifica conflito local (mesmo profissional, horário sobreposto, não cancelado) */
  function temConflito(iso, horaStr, duracaoMin, ignorarId, usuarioId) {
    const lista = state.agendamentosPorDia[iso] || [];
    const [hh, mm] = horaStr.split(':').map(Number);
    const inicioNovo = hh * 60 + mm;
    const fimNovo = inicioNovo + duracaoMin;

    return lista.some(a => {
      if (ignorarId && String(a.id) === String(ignorarId)) return false;
      if (usuarioId && String(a.usuario_id) !== String(usuarioId)) return false;
      if (a.status_agendamento === 'cancelado') return false;
      const d = parseLocalDate(a.data_agendamento);
      if (isNaN(d.getTime())) return false;
      const inicioExist = d.getHours() * 60 + d.getMinutes();
      const fimExist = inicioExist + obterDuracaoMinutos(a);
      return inicioNovo < fimExist && fimNovo > inicioExist;
    });
  }


  function formatarRotuloDia(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function formatarFaixaSemana(isos) {
    if (!isos || !isos.length) return '';
    const a = parseLocalDate(isos[0] + 'T00:00:00');
    const b = parseLocalDate(isos[Math.min(6, isos.length - 1)] + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
    const ma = MESES[a.getMonth()];
    const mb = MESES[b.getMonth()];
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + ' – ' + b.getDate() + ' de ' + ma + ' de ' + a.getFullYear();
    }
    return a.getDate() + ' ' + ma.slice(0, 3) + ' – ' + b.getDate() + ' ' + mb.slice(0, 3) + ' de ' + b.getFullYear();
  }

  function atualizarOrientacaoGrade(isoCentro) {
    const badge = $('#badgeDiaFlutuante');
    const faixa = $('#labelFaixaSemana');
    if (isoCentro) {
      const d = parseLocalDate(isoCentro + 'T00:00:00');
      if (badge && !isNaN(d.getTime())) {
        badge.textContent = formatarRotuloDia(d) + (ehHoje(d) ? ' · Hoje' : '');
        badge.classList.toggle('badge-hoje', ehHoje(d));
        badge.style.display = 'flex';
      }
    }
    if (faixa && state.colunas.length) {
      // semana visível aproximada: primeiros 7 a partir do centro ou do início
      const idx = Math.max(0, state.colunas.indexOf(isoCentro));
      const slice = state.colunas.slice(Math.max(0, idx - 3), Math.max(0, idx - 3) + 7);
      const base = slice.length ? slice : state.colunas.slice(0, 7);
      faixa.textContent = formatarFaixaSemana(base);
    }
  }

  function centralizarColunaPorIso(iso, suave) {
    const scroll = $('#grid-scroll');
    const header = $('#colunasHeaderConteudo');
    if (!scroll || !header || !iso) return;
    const alvo = header.querySelector('.col-header-dia[data-iso="' + iso + '"]');
    if (!alvo) return;
    const alvoRect = alvo.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const delta = (alvoRect.left - scrollRect.left) - (scroll.clientWidth / 2) + (alvoRect.width / 2);
    const destino = Math.max(0, scroll.scrollLeft + delta);
    if (suave && typeof scroll.scrollTo === 'function') {
      scroll.scrollTo({ left: destino, behavior: 'smooth' });
    } else {
      scroll.scrollLeft = destino;
    }
    state.diaSelecionado = iso;
    // evita loop: não re-centraliza
    $all('.col-header-dia').forEach(h => h.classList.toggle('dia-selecionado', h.dataset.iso === iso));
    $all('.coluna-dia').forEach(c => c.classList.toggle('coluna-selecionada', c.dataset.iso === iso));
    atualizarIndicadorSync(iso);
    atualizarOrientacaoGrade(iso);
  }

  async function irParaData(iso) {
    if (!iso || !idsAtivosParaGrade().length) {
      mostrarToast('Selecione um profissional primeiro.', 'info');
      return;
    }
    const data = parseLocalDate(iso + 'T00:00:00');
    if (isNaN(data.getTime())) {
      mostrarToast('Data inválida.', 'error');
      return;
    }
    state.mesAtual = { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    mostrarCamada(4);
    // Se a coluna já existe, só centraliza
    if (state.colunas.includes(iso)) {
      centralizarColunaPorIso(iso, true);
      return;
    }
    // Carrega a semana que contém a data e centraliza
    await carregarGradeInicial(inicioDaSemana(data));
    // aguarda layout
    requestAnimationFrame(() => {
      centralizarColunaPorIso(iso, true);
    });
  }

  function marcarSeparadoresMes() {
    const header = $('#colunasHeaderConteudo');
    const cols = $('#colunasDiasConteudo');
    if (!header || !cols) return;
    // limpa marcadores antigos
    header.querySelectorAll('.sep-mes-header').forEach(el => el.classList.remove('sep-mes-header'));
    cols.querySelectorAll('.sep-mes-coluna').forEach(el => {
      el.classList.remove('sep-mes-coluna');
      const lab = el.querySelector('.sep-mes-label');
      if (lab) lab.remove();
    });
    const headers = Array.from(header.children);
    let prevMes = null;
    headers.forEach((h, i) => {
      const iso = h.dataset.iso;
      if (!iso) return;
      const d = parseLocalDate(iso + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const mes = d.getMonth();
      if (prevMes !== null && mes !== prevMes) {
        h.classList.add('sep-mes-header');
        const col = cols.querySelector('.coluna-dia[data-iso="' + iso + '"]');
        if (col) {
          col.classList.add('sep-mes-coluna');
          if (!col.querySelector('.sep-mes-label')) {
            const lab = document.createElement('div');
            lab.className = 'sep-mes-label';
            lab.textContent = MESES[mes];
            col.appendChild(lab);
          }
        }
      }
      prevMes = mes;
    });
  }

  let _snapTimer = null;
  let _snapLock = false;
  function agendarSnapAoCentro() {
    if (_snapLock || state.carregandoMais) return;
    clearTimeout(_snapTimer);
    _snapTimer = setTimeout(() => {
      if (state.carregandoMais) return;
      const scroll = $('#grid-scroll');
      const header = $('#colunasHeaderConteudo');
      if (!scroll || !header || !header.children.length) return;
      const rect = scroll.getBoundingClientRect();
      const centro = rect.left + rect.width / 2;
      let melhor = null;
      let melhorDist = Infinity;
      for (const col of header.children) {
        const r = col.getBoundingClientRect();
        const mid = (r.left + r.right) / 2;
        const dist = Math.abs(mid - centro);
        if (dist < melhorDist) {
          melhorDist = dist;
          melhor = col;
        }
      }
      if (!melhor || !melhor.dataset.iso) return;
      // só snap se não estiver quase no centro (evita jitter)
      if (melhorDist < 12) {
        selecionarDiaColuna(melhor.dataset.iso);
        atualizarOrientacaoGrade(melhor.dataset.iso);
        return;
      }
      _snapLock = true;
      centralizarColunaPorIso(melhor.dataset.iso, true);
      setTimeout(() => { _snapLock = false; }, 320);
    }, 140);
  }



  function passaFiltros(a) {
    if (state.filtros.status !== 'todos' && a.status_agendamento !== state.filtros.status) return false;
    if (state.filtros.origem !== 'todos') {
      const origem = a.origem_paciente === 'portal' ? 'portal' : 'recepcao';
      if (origem !== state.filtros.origem) return false;
    }
    return true;
  }

  function corDoProfissional(usuarioId) {
    const idx = state.profissionais.findIndex(p => String(p.id) === String(usuarioId));
    return CORES_PROF[(idx >= 0 ? idx : 0) % CORES_PROF.length];
  }

  function idsAtivosParaGrade() {
    if (state.modoMulti && state.profissionaisVisiveis.length) return state.profissionaisVisiveis.map(String);
    if (state.profissional) return [String(state.profissional.id)];
    return [];
  }

  function larguraColunaDia() {
    if (!state.modoMulti) return COL_LARGURA;
    return Math.max(1, state.profissionaisVisiveis.length) * COL_LARGURA_SUB;
  }

  function aplicarLarguraCSS() {
    document.documentElement.style.setProperty('--col-width', larguraColunaDia() + 'px');
  }

  function ativarModoMulti(ligado) {
    state.modoMulti = !!ligado;
    if (state.modoMulti) {
      if (!state.profissionaisVisiveis.length) {
        state.profissionaisVisiveis = state.profissionais.map(p => String(p.id));
      }
      const titulo = $('#tituloProfissional');
      if (titulo) titulo.innerHTML = 'Equipe <span class="separator">|</span> <span style="color:var(--emerald)">Multi-agenda</span>';
    } else if (state.profissional) {
      state.profissionaisVisiveis = [String(state.profissional.id)];
      const titulo = $('#tituloProfissional');
      if (titulo) titulo.innerHTML = escapeHtml(state.profissional.nome) + ' <span class="separator">|</span> <span style="color:var(--emerald)">Agenda</span>';
    }
    atualizarToggleMultiUI();
    renderChipsMulti();
    aplicarLarguraCSS();
    if (document.querySelector('#camada4.ativa') && state.colunas.length) recarregarGridAtual();
  }

  function toggleProfissionalVisivel(id) {
    const sid = String(id);
    const set = new Set(state.profissionaisVisiveis.map(String));
    if (set.has(sid)) {
      if (set.size <= 1) { mostrarToast('Mantenha ao menos um profissional visível.', 'info'); return; }
      set.delete(sid);
    } else set.add(sid);
    state.profissionaisVisiveis = Array.from(set);
    renderChipsMulti();
    aplicarLarguraCSS();
    if (document.querySelector('#camada4.ativa')) recarregarGridAtual();
  }

  function atualizarToggleMultiUI() {
    const btn = $('#btnToggleMulti');
    if (btn) {
      btn.classList.toggle('filtro-ativo', state.modoMulti);
      btn.innerHTML = state.modoMulti ? '<i class="fas fa-users"></i> Multi ON' : '<i class="fas fa-user"></i> Multi';
    }
    const sel = $('#selectProfissionalRapido');
    if (sel) sel.style.display = state.modoMulti ? 'none' : '';
    const chips = $('#chipsMultiProf');
    if (chips) chips.style.display = state.modoMulti ? 'flex' : 'none';
  }

  function renderChipsMulti() {
    const wrap = $('#chipsMultiProf');
    if (!wrap) return;
    wrap.innerHTML = state.profissionais.map((p, idx) => {
      const cor = CORES_PROF[idx % CORES_PROF.length];
      const ativo = state.profissionaisVisiveis.map(String).includes(String(p.id));
      return '<button type="button" class="chip-prof ' + (ativo ? 'chip-ativo' : '') + '" data-prof-id="' + p.id + '" style="' + (ativo ? 'border-color:' + cor.border + ';background:' + cor.bg + '33;color:#e2e8f0' : '') + '"><span class="chip-dot" style="background:' + cor.border + '"></span>' + escapeHtml((p.nome || '').split(' ')[0]) + '</button>';
    }).join('');
    wrap.querySelectorAll('[data-prof-id]').forEach(btn => {
      btn.addEventListener('click', () => toggleProfissionalVisivel(btn.dataset.profId));
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // Navegação entre camadas
  // ═══════════════════════════════════════════════════════════════
  function mostrarCamada(n) {
    $all('.camada').forEach(c => c.classList.remove('ativa'));
    const alvo = $(`#camada${n}`);
    if (alvo) alvo.classList.add('ativa');

    const btnVoltar = $('#btnVoltarCamada');
    const btnHoje = $('#btnHojeHeader');
    if (btnVoltar) btnVoltar.style.display = n === 1 ? 'none' : 'flex';
    if (btnHoje) btnHoje.style.display = n >= 2 ? 'flex' : 'none';

    const barraFiltros = $('#barraFiltrosGrade');
    if (barraFiltros) barraFiltros.style.display = n === 4 ? 'flex' : 'none';
    const multiBar = $('#barraMultiProf');
    if (multiBar) multiBar.style.display = n === 4 ? 'flex' : 'none';
    const ori = $('#orientacaoGrade');
    if (ori) ori.classList.toggle('visivel', n === 4);
    if (n !== 4) {
      const badge = $('#badgeDiaFlutuante');
      if (badge) badge.style.display = 'none';
    }


    const subtitulos = {
      1: 'Selecione um profissional para começar',
      2: 'Toque em um mês para abrir o calendário',
      3: 'Toque em um dia para abrir a grade de horários',
      4: 'Arraste para reagendar • Toque numa célula vazia para criar'
    };
    const sub = $('#subtituloCamada');
    if (sub) sub.textContent = subtitulos[n] || '';
  }

  const btnVoltarCamada = $('#btnVoltarCamada');
  if (btnVoltarCamada) {
    btnVoltarCamada.addEventListener('click', () => {
      const atual = document.querySelector('.camada.ativa');
      if (!atual) return;
      if (atual.id === 'camada4') { mostrarCamada(3); carregarMesCalendario(); }
      else if (atual.id === 'camada3') { mostrarCamada(2); carregarPanoramaAno(); }
      else if (atual.id === 'camada2') { mostrarCamada(1); }
    });
  }

  const btnHojeHeader = $('#btnHojeHeader');
  if (btnHojeHeader) btnHojeHeader.addEventListener('click', () => irParaHoje());

  function irParaHoje() {
    if (!state.profissional) return;
    const hoje = new Date();
    state.mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    mostrarCamada(4);
    carregarGradeInicial(inicioDaSemana(hoje));
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMADA 1 — Profissionais
  // ═══════════════════════════════════════════════════════════════
  async function carregarProfissionais() {
    const wrap = $('#listaProfissionais');
    if (!wrap) return;
    try {
      const res = await authFetch(`${API}/profissionais`);
      const data = await res.json();
      if (!data.success || !data.profissionais.length) {
        wrap.innerHTML = `<div class="col-span-full text-center py-10" style="color:rgba(148,163,184,0.5)">
          <i class="fas fa-user-md text-3xl mb-3"></i><p>Nenhum profissional encontrado na equipe.</p></div>`;
        return;
      }
      state.profissionais = data.profissionais;
      wrap.innerHTML = data.profissionais.map(p => `
        <div class="prof-card anim-enter p-5 flex flex-col items-center text-center gap-3" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}">
          <div class="prof-avatar">${iniciais(p.nome)}</div>
          <div>
            <p class="prof-nome">${escapeHtml(p.nome)}</p>
            <p class="prof-cargo">${escapeHtml(p.cargo || '')}</p>
          </div>
        </div>
      `).join('');

      wrap.querySelectorAll('.prof-card').forEach(card => {
        card.addEventListener('click', () => selecionarProfissional(card.dataset.id, card.dataset.nome));
      });
      popularSelectProfissional();
    } catch (err) {
      wrap.innerHTML = `<div class="col-span-full text-center py-10" style="color:#f87171">Erro ao carregar profissionais.</div>`;
    }
  }

  function selecionarProfissional(id, nome) {
    state.profissional = { id, nome };
    state.modoMulti = false;
    state.profissionaisVisiveis = [String(id)];
    const titulo = $('#tituloProfissional');
    if (titulo) {
      titulo.innerHTML = `${escapeHtml(nome)} <span class="separator">|</span> <span style="color:var(--emerald)">Agenda</span>`;
    }
    const sel = $('#selectProfissionalRapido');
    if (sel) sel.value = String(id);
    atualizarToggleMultiUI();
    mostrarCamada(2);
    carregarPanoramaAno();
  }

  function popularSelectProfissional() {
    const sel = $('#selectProfissionalRapido');
    if (!sel) return;
    sel.innerHTML = state.profissionais.map(p =>
      `<option value="${p.id}">${escapeHtml(p.nome)}</option>`
    ).join('');
    if (state.profissional) sel.value = String(state.profissional.id);
    sel.onchange = () => {
      const p = state.profissionais.find(x => String(x.id) === sel.value);
      if (!p) return;
      state.profissional = { id: p.id, nome: p.nome };
      const titulo = $('#tituloProfissional');
      if (titulo) {
        titulo.innerHTML = `${escapeHtml(p.nome)} <span class="separator">|</span> <span style="color:var(--emerald)">Agenda</span>`;
      }
      // Se já está na grade, recarrega
      if (document.querySelector('#camada4.ativa') && state.colunas.length) {
        recarregarGridAtual();
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMADA 2 — Panorama Anual
  // ═══════════════════════════════════════════════════════════════
  const btnAnoAnterior = $('#btnAnoAnterior');
  const btnProximoAno = $('#btnProximoAno');
  if (btnAnoAnterior) btnAnoAnterior.addEventListener('click', () => { state.ano--; carregarPanoramaAno(); });
  if (btnProximoAno) btnProximoAno.addEventListener('click', () => { state.ano++; carregarPanoramaAno(); });

  async function carregarPanoramaAno() {
    const label = $('#labelAno');
    if (label) label.textContent = state.ano;
    const grid = $('#gridMeses');
    if (!grid) return;
    grid.innerHTML = `<div class="loader-spin col-span-full"></div>`;

    try {
      const res = await authFetch(`${API}/indicadores-ano?profissionalId=${state.profissional.id}&ano=${state.ano}`);
      const data = await res.json();
      const diasComAgenda = new Set(
        (data.dias || []).map(d => formatarDataISO(parseLocalDate(d.dia))).filter(Boolean)
      );
      grid.innerHTML = '';
      for (let mes = 1; mes <= 12; mes++) grid.appendChild(criarCardMes(mes, diasComAgenda));
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-10" style="color:#f87171">Erro ao carregar panorama anual.</div>`;
    }
  }

  function criarCardMes(mes, diasComAgenda) {
    const card = document.createElement('div');
    card.className = 'mes-card p-4';
    const primeiroDiaSemana = new Date(state.ano, mes - 1, 1).getDay();
    const totalDias = new Date(state.ano, mes, 0).getDate();
    let cells = '';
    for (let i = 0; i < primeiroDiaSemana; i++) cells += `<div></div>`;
    for (let dia = 1; dia <= totalDias; dia++) {
      const d = new Date(state.ano, mes - 1, dia);
      const iso = formatarDataISO(d);
      const temAgenda = iso && diasComAgenda.has(iso);
      cells += `<div class="mini-dia ${temAgenda ? 'tem-agenda' : ''} ${ehHoje(d) ? 'hoje' : ''}">${dia}${temAgenda ? '<span class="dot"></span>' : ''}</div>`;
    }
    card.innerHTML = `<p class="mes-card-titulo mb-3">${MESES[mes - 1]}</p><div class="grid grid-cols-7 gap-0.5">${cells}</div>`;
    card.addEventListener('click', () => {
      state.mesAtual = { ano: state.ano, mes };
      mostrarCamada(3);
      carregarMesCalendario();
    });
    return card;
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMADA 3 — Calendário do mês
  // ═══════════════════════════════════════════════════════════════
  const btnMesAnterior = $('#btnMesAnterior');
  const btnProximoMes = $('#btnProximoMes');
  if (btnMesAnterior) btnMesAnterior.addEventListener('click', () => mudarMes(-1));
  if (btnProximoMes) btnProximoMes.addEventListener('click', () => mudarMes(1));

  function mudarMes(delta) {
    let { ano, mes } = state.mesAtual;
    mes += delta;
    if (mes < 1) { mes = 12; ano--; }
    if (mes > 12) { mes = 1; ano++; }
    state.mesAtual = { ano, mes };
    carregarMesCalendario();
  }

  async function carregarMesCalendario() {
    const { ano, mes } = state.mesAtual;
    const label = $('#labelMes');
    if (label) label.textContent = `${MESES[mes - 1]} / ${ano}`;
    const grid = $('#gridDiasMes');
    if (!grid) return;
    grid.innerHTML = `<div class="loader-spin col-span-full"></div>`;

    try {
      const res = await authFetch(`${API}/dias-mes?profissionalId=${state.profissional.id}&ano=${ano}&mes=${mes}`);
      const data = await res.json();
      const contagemPorDia = {};
      (data.dias || []).forEach(d => {
        const iso = formatarDataISO(parseLocalDate(d.dia));
        if (iso) contagemPorDia[iso] = d.total;
      });

      const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
      const totalDias = new Date(ano, mes, 0).getDate();
      const diasMesAnterior = new Date(ano, mes - 1, 0).getDate();

      let html = '';
      for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
        html += `<div class="mes-dia-cel fora-do-mes">${diasMesAnterior - i}</div>`;
      }
      for (let dia = 1; dia <= totalDias; dia++) {
        const d = new Date(ano, mes - 1, dia);
        const iso = formatarDataISO(d);
        const total = contagemPorDia[iso];
        // Heatmap leve de ocupação
        let intensidade = '';
        if (total >= 8) intensidade = 'alta';
        else if (total >= 4) intensidade = 'media';
        html += `<div class="mes-dia-cel ${ehHoje(d) ? 'hoje' : ''} ${intensidade}" data-iso="${iso}">
          <span>${dia}</span>${total ? `<span class="contador">${total}</span>` : ''}
        </div>`;
      }
      grid.innerHTML = html;

      grid.querySelectorAll('.mes-dia-cel[data-iso]').forEach(cel => {
        cel.addEventListener('click', () => {
          const dataClicada = parseLocalDate(cel.dataset.iso + 'T00:00:00');
          if (isNaN(dataClicada.getTime())) return;
          mostrarCamada(4);
          carregarGradeInicial(inicioDaSemana(dataClicada));
        });
      });
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-10" style="color:#f87171">Erro ao carregar o mês.</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMADA 4 — Grade
  // ═══════════════════════════════════════════════════════════════
  function montarColunaHoras() {
    const col = $('#colunaHoras');
    if (!col) return;
    let html = '';
    for (let h = 0; h < 24; h++) {
      html += `<div class="hora-linha" style="height:${HORA_ALTURA}px;min-height:${HORA_ALTURA}px">${String(h).padStart(2, '0')}:00</div>`;
    }
    col.innerHTML = html;
    document.documentElement.style.setProperty('--hora-altura', HORA_ALTURA + 'px');
  }
  montarColunaHoras();

  async function carregarGradeInicial(dataInicioSemana) {
    state.colunas = [];
    state.agendamentosPorDia = {};
    aplicarLarguraCSS();
    ['#colunasHeaderConteudo', '#colunasDiasConteudo', '#faixaLembretesConteudo'].forEach(sel => {
      const el = $(sel);
      if (el) el.innerHTML = '';
    });

    const listaDias = [];
    // 14 dias (2 semanas) — grade finita, sem scroll infinito automático
    for (let i = 0; i < 14; i++) listaDias.push(somarDias(dataInicioSemana, i));
    await adicionarColunas(listaDias, 'append');

    const scroll = $('#grid-scroll');
    if (scroll) scroll.scrollLeft = 0;
    atualizarIndicadorSync();
    atualizarOcupacaoHeader();
    marcarSeparadoresMes();
  }

  async function adicionarColunas(dias, modo) {
    const isos = dias.map(d => formatarDataISO(d)).filter(Boolean);
    if (!isos.length) return;

    const ids = idsAtivosParaGrade();
    if (!ids.length) { mostrarToast('Selecione ao menos um profissional.', 'info'); return; }
    const inicio = isos[0];
    const fim = isos[isos.length - 1] + ' 23:59:59';
    const qs = ids.length > 1 ? `profissionalIds=${ids.join(',')}` : `profissionalId=${ids[0]}`;

    let agendamentosPorDia = {};
    try {
      const res = await authFetch(
        `${API}/grade?${qs}&inicio=${inicio}&fim=${encodeURIComponent(fim)}`
      );
      const data = await res.json();
      (data.agendamentos || []).forEach(a => {
        const iso = formatarDataISO(parseLocalDate(a.data_agendamento));
        if (!iso) return;
        (agendamentosPorDia[iso] = agendamentosPorDia[iso] || []).push(a);
      });
    } catch (err) {
      mostrarToast('Erro ao carregar agendamentos da semana.', 'error');
    }

    const headerFrag = document.createDocumentFragment();
    const colsFrag = document.createDocumentFragment();
    const lembretesFrag = document.createDocumentFragment();
    let adicionados = 0;

    dias.forEach(d => {
      const iso = formatarDataISO(d);
      if (!iso || state.colunas.includes(iso)) return;

      state.agendamentosPorDia[iso] = agendamentosPorDia[iso] || [];

      const headerCel = document.createElement('div');
      headerCel.className = `col-header-dia ${ehHoje(d) ? 'hoje-col' : ''}`;
      headerCel.dataset.iso = iso;
      const totalAtivos = (state.agendamentosPorDia[iso] || []).filter(a => a.status_agendamento !== 'cancelado').length;
      headerCel.style.flex = '0 0 ' + larguraColunaDia() + 'px';
      if (state.modoMulti) {
        const subHeaders = state.profissionaisVisiveis.map(pid => {
          const p = state.profissionais.find(x => String(x.id) === String(pid));
          const cor = corDoProfissional(pid);
          const nome = p ? p.nome.split(' ')[0] : pid;
          return '<div class="sub-header-prof" style="border-bottom:2px solid ' + cor.border + '">' + escapeHtml(nome) + '</div>';
        }).join('');
        headerCel.innerHTML = '<div class="dia-semana">' + formatarRotuloDia(d) + '</div>' + (ehHoje(d) ? '<div class="dia-hoje-tag">Hoje</div>' : '') +  (totalAtivos ? '<div class="col-ocupacao">' + totalAtivos + '</div>' : '') + '<div class="sub-headers-row">' + subHeaders + '</div>';
      } else {
        headerCel.innerHTML = '<div class="dia-semana">' + formatarRotuloDia(d) + '</div>' + (ehHoje(d) ? '<div class="dia-hoje-tag">Hoje</div>' : '') + (totalAtivos ? '<div class="col-ocupacao" title="' + totalAtivos + ' agendamento(s)">' + totalAtivos + '</div>' : '');
      }
      headerCel.addEventListener('click', () => selecionarDiaColuna(iso));
      headerFrag.appendChild(headerCel);

      const lembreteCel = document.createElement('div');
      lembreteCel.className = 'lembrete-cel';
      lembreteCel.dataset.iso = iso;
      lembretesFrag.appendChild(lembreteCel);

      colsFrag.appendChild(criarColunaDia(iso, state.agendamentosPorDia[iso]));
      state.colunas.push(iso);
      adicionados++;
    });

    if (!adicionados) return;

    if (modo === 'prepend') {
      $('#colunasHeaderConteudo')?.prepend(headerFrag);
      $('#colunasDiasConteudo')?.prepend(colsFrag);
      $('#faixaLembretesConteudo')?.prepend(lembretesFrag);
    } else {
      $('#colunasHeaderConteudo')?.append(headerFrag);
      $('#colunasDiasConteudo')?.append(colsFrag);
      $('#faixaLembretesConteudo')?.append(lembretesFrag);
    }
    state.colunas.sort();
    marcarSeparadoresMes();
  }

  function criarColunaDia(iso, agendamentos) {
    const col = document.createElement('div');
    col.className = 'coluna-dia' + (state.modoMulti ? ' coluna-multi' : '');
    col.dataset.iso = iso;
    col.style.flex = '0 0 ' + larguraColunaDia() + 'px';

    if (state.modoMulti) {
      const row = document.createElement('div');
      row.className = 'subcols-row';
      state.profissionaisVisiveis.forEach(pid => {
        const sub = document.createElement('div');
        sub.className = 'subcoluna-prof';
        sub.dataset.iso = iso;
        sub.dataset.profId = pid;
        sub.style.flex = '0 0 ' + COL_LARGURA_SUB + 'px';
        sub.style.position = 'relative';
        sub.style.borderRight = '1px solid rgba(148,163,184,0.08)';
        let cells = '';
        for (let h = 0; h < 24; h++) cells += '<div class="celula-hora" data-hora="' + h + '" data-prof-id="' + pid + '"><span class="cel-corner">' + iso.slice(8,10) + '/' + iso.slice(5,7) + '</span></div>';
        sub.innerHTML = cells;
        (agendamentos || []).filter(a => String(a.usuario_id) === String(pid) && passaFiltros(a)).forEach((a, idx) => {
          const bloco = criarBlocoAgendamento(a, idx);
          if (bloco) sub.appendChild(bloco);
        });
        bindCelulasHora(sub, iso, pid);
        row.appendChild(sub);
      });
      col.appendChild(row);
    } else {
      let cells = '';
      for (let h = 0; h < 24; h++) cells += '<div class="celula-hora" data-hora="' + h + '"><span class="cel-corner">' + iso.slice(8,10) + '/' + iso.slice(5,7) + '</span></div>';
      col.innerHTML = cells;
      (agendamentos || []).filter(passaFiltros).forEach((a, idx) => {
        const bloco = criarBlocoAgendamento(a, idx);
        if (bloco) col.appendChild(bloco);
      });
      bindCelulasHora(col, iso, state.profissional && state.profissional.id);
    }

    col.addEventListener('click', () => selecionarDiaColuna(iso), true);
    return col;
  }


  function fecharPopupCelula() {
    const pop = $('#popupCelula');
    if (pop) pop.remove();
  }

  function abrirPopupCelula(evento, iso, hora, profId, celEl) {
    fecharPopupCelula();
    selecionarDiaColuna(iso);
    const d = parseLocalDate(iso + 'T00:00:00');
    const mesNome = isNaN(d.getTime()) ? '' : MESES[d.getMonth()];
    const diaRotulo = isNaN(d.getTime()) ? iso : formatarRotuloDia(d);
    const horaLabel = String(hora).padStart(2, '0') + ':00';

    // agendamentos nesta hora (mesma hora cheia)
    const lista = (state.agendamentosPorDia[iso] || []).filter(a => {
      if (a.status_agendamento === 'cancelado' && state.filtros.status !== 'cancelado') return false;
      if (profId && String(a.usuario_id) !== String(profId)) return false;
      const ad = parseLocalDate(a.data_agendamento);
      if (isNaN(ad.getTime())) return false;
      return ad.getHours() === Number(hora);
    });

    const pop = document.createElement('div');
    pop.id = 'popupCelula';
    pop.className = 'popup-celula';

    let bodyAg = '';
    if (lista.length) {
      bodyAg = lista.map(a => {
        const ad = parseLocalDate(a.data_agendamento);
        const hm = isNaN(ad.getTime()) ? '' : String(ad.getHours()).padStart(2,'0') + ':' + String(ad.getMinutes()).padStart(2,'0');
        return '<div class="popup-ag-item" data-id="' + a.id + '">' +
          '<div class="popup-ag-nome">' + escapeHtml(a.nome || 'Paciente') + '</div>' +
          '<div class="popup-ag-meta">' + hm + (a.tipo_terapia ? ' · ' + escapeHtml(a.tipo_terapia) : '') +
          (a.status_agendamento ? ' · ' + escapeHtml(a.status_agendamento) : '') + '</div>' +
          '</div>';
      }).join('');
    } else {
      bodyAg = '<p class="popup-vazio">Nenhum agendamento neste horário.</p>';
    }

    const profNome = (state.profissionais.find(x => String(x.id) === String(profId)) || {}).nome || '';

    pop.innerHTML =
      '<div class="popup-celula-cab">' +
        '<div><strong>' + escapeHtml(diaRotulo) + '</strong>' +
        (mesNome ? '<span class="popup-mes"> · ' + mesNome + (isNaN(d.getTime()) ? '' : ' ' + d.getFullYear()) + '</span>' : '') +
        '</div>' +
        '<button type="button" class="popup-x" aria-label="Fechar"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="popup-celula-hora"><i class="fas fa-clock"></i> ' + horaLabel +
        (profNome ? ' · ' + escapeHtml(profNome.split(' ')[0]) : '') +
      '</div>' +
      '<div class="popup-celula-body">' + bodyAg + '</div>' +
      '<div class="popup-celula-acoes">' +
        '<button type="button" class="popup-btn-prim" data-acao="novo"><i class="fas fa-plus"></i> Novo neste horário</button>' +
      '</div>';

    document.body.appendChild(pop);

    // posiciona próximo à célula
    const rect = (celEl || evento.target).getBoundingClientRect();
    const pw = pop.offsetWidth || 260;
    const ph = pop.offsetHeight || 180;
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    pop.querySelector('.popup-x').addEventListener('click', fecharPopupCelula);
    pop.querySelector('[data-acao="novo"]').addEventListener('click', () => {
      fecharPopupCelula();
      abrirModalAgendamento({ novo: true, data: iso, hora: horaLabel, usuarioId: profId });
    });
    pop.querySelectorAll('.popup-ag-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const a = Object.values(state.agendamentosPorDia).flat().find(x => String(x.id) === String(id));
        fecharPopupCelula();
        if (a) abrirMenuContextual({ clientX: left + 40, clientY: top + 40 }, a);
      });
    });

    setTimeout(() => {
      const closer = (ev) => {
        if (!pop.contains(ev.target)) {
          fecharPopupCelula();
          document.removeEventListener('click', closer);
        }
      };
      document.addEventListener('click', closer);
    }, 0);
  }

  function bindCelulasHora(container, iso, profId) {
    container.querySelectorAll('.celula-hora').forEach(cel => {
      cel.addEventListener('click', (e) => {
        if (e.target !== cel && !e.target.classList.contains('celula-hora')) return;
        // se clicou em bloco, o bloco trata o menu
        if (e.target.closest && e.target.closest('.bloco-agendamento')) return;
        selecionarDiaColuna(iso);
        const hora = String(cel.dataset.hora || '0').padStart(2, '0');
        const uid = cel.dataset.profId || profId;
        abrirPopupCelula(e, iso, hora, uid, cel);
      });
      cel.addEventListener('dragover', (e) => { e.preventDefault(); cel.classList.add('drop-hover'); });
      cel.addEventListener('dragleave', () => cel.classList.remove('drop-hover'));
      cel.addEventListener('drop', (e) => {
        e.preventDefault();
        cel.classList.remove('drop-hover');
        const agendamentoId = e.dataTransfer.getData('text/agendamento-id');
        if (!agendamentoId) return;
        const horaStr = minutosParaHoraStr(snapMinutos(Number(cel.dataset.hora || 0) * 60));
        const uid = cel.dataset.profId || profId;
        const agOrig = Object.values(state.agendamentosPorDia).flat().find(x => String(x.id) === String(agendamentoId));
        if (temConflito(iso, horaStr, obterDuracaoMinutos(agOrig || {}), agendamentoId, uid)) {
          mostrarToast('Conflito de horário com outro agendamento.', 'error');
          return;
        }
        // PATCH includes usuario_id when multi
        (async () => {
          const body = { data_agendamento: iso + ' ' + horaStr + ':00' };
          if (uid) body.usuario_id = uid;
          try {
            const res = await authFetch(API + '/agendamentos/' + agendamentoId, { method: 'PATCH', body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) { mostrarToast('Agendamento reagendado.'); recarregarGridAtual(); }
            else mostrarToast(data.message || 'Não foi possível reagendar.', 'error');
          } catch (err) {}
        })();
      });
    });
  }


  function selecionarDiaColuna(iso, opts) {
    if (!iso) return;
    state.diaSelecionado = iso;
    $all('.col-header-dia').forEach(h => h.classList.toggle('dia-selecionado', h.dataset.iso === iso));
    $all('.coluna-dia').forEach(c => c.classList.toggle('coluna-selecionada', c.dataset.iso === iso));
    atualizarIndicadorSync(iso);
    // Cabeçalho "acompanha" a célula: centraliza a coluna do dia (como se arrastasse)
    if (!opts || opts.centralizar !== false) {
      try { centralizarColunaPorIso(iso, true); } catch (e) {}
    }
  }

  function criarBlocoAgendamento(a, idx) {
    const d = parseLocalDate(a.data_agendamento);
    if (isNaN(d.getTime())) {
      console.warn('[Agenda] Data inválida', a.id, a.data_agendamento);
      return null;
    }

    const minutosDoDia = d.getHours() * 60 + d.getMinutes();
    const duracaoMin = obterDuracaoMinutos(a);
    const topPx = (minutosDoDia / 60) * HORA_ALTURA;
    const heightPx = Math.max(44, (duracaoMin / 60) * HORA_ALTURA - 6);

    if (isNaN(topPx) || isNaN(heightPx)) return null;

    const div = document.createElement('div');
    const cancelado = a.status_agendamento === 'cancelado';
    const origemClasse = a.origem_paciente === 'portal' ? 'origem-portal' : 'origem-recepcao';
    const statusClasse = a.status_agendamento === 'confirmado' ? 'status-confirmado'
      : a.status_agendamento === 'realizado' ? 'status-realizado' : '';

    const corP = corDoProfissional(a.usuario_id);
    div.className = `bloco-agendamento ${origemClasse} ${statusClasse} ${cancelado ? 'cancelado-bloco' : ''}`;
    div.style.top = `${topPx}px`;
    div.style.height = `${heightPx}px`;
    div.style.background = corP.bg;
    div.style.borderLeftColor = corP.border;
    div.dataset.id = a.id;
    div.draggable = !cancelado;
    div.title = `${a.nome || 'Paciente'} • ${duracaoMin} min • ${a.status_agendamento || ''}`;

    div.innerHTML = `
      <div class="bloco-hora">${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${duracaoMin}min</div>
      <div class="bloco-nome">${escapeHtml(a.nome || 'Paciente')}</div>
      ${a.tipo_terapia ? `<div class="bloco-tipo">${escapeHtml(a.tipo_terapia)}</div>` : ''}
    `;

    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/agendamento-id', String(a.id));
      div.classList.add('arrastando');
    });
    div.addEventListener('dragend', () => div.classList.remove('arrastando'));
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirMenuContextual(e, a);
    });

    return div;
  }

  // Scroll infinito
  const gridScroll = $('#grid-scroll');
  if (gridScroll) {
    gridScroll.addEventListener('scroll', () => {
      atualizarIndicadorSync();
      agendarSnapAoCentro();
    });
  }

  // Arrastar o cabeçalho de dias para navegar (scroll + carregar semanas ao chegar na borda)
  (function bindHeaderDrag() {
    const header = $('#colunas-header') || $('#colunasHeaderConteudo');
    const scroll = $('#grid-scroll');
    if (!header || !scroll) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    header.style.cursor = 'grab';
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = scroll.scrollLeft;
      header.style.cursor = 'grabbing';
      header.classList.add('header-dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      scroll.scrollLeft = startScroll - dx;
    });
    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = 'grab';
      header.classList.remove('header-dragging');
      if (!moved) return;
      // ao soltar perto da borda, carrega semana seguinte/anterior (navegação controlada)
      const w = larguraColunaDia();
      if (scroll.scrollLeft + scroll.clientWidth > scroll.scrollWidth - w * 1.5) {
        await carregarMaisColunas('proxima');
      } else if (scroll.scrollLeft < w * 1.2) {
        await carregarMaisColunas('anterior');
      }
      agendarSnapAoCentro();
    });

    // touch
    header.addEventListener('touchstart', (e) => {
      if (!e.touches[0]) return;
      dragging = true;
      moved = false;
      startX = e.touches[0].clientX;
      startScroll = scroll.scrollLeft;
    }, { passive: true });
    header.addEventListener('touchmove', (e) => {
      if (!dragging || !e.touches[0]) return;
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      scroll.scrollLeft = startScroll - dx;
    }, { passive: true });
    header.addEventListener('touchend', async () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      const w = larguraColunaDia();
      if (scroll.scrollLeft + scroll.clientWidth > scroll.scrollWidth - w * 1.5) {
        await carregarMaisColunas('proxima');
      } else if (scroll.scrollLeft < w * 1.2) {
        await carregarMaisColunas('anterior');
      }
      agendarSnapAoCentro();
    });
  })();


  async function carregarMaisColunas(direcao) {
    if (state.carregandoMais || !idsAtivosParaGrade().length || !state.colunas.length) return;
    state.carregandoMais = true;
    try {
      if (direcao === 'proxima') {
        const ultimoIso = state.colunas[state.colunas.length - 1];
        const inicio = somarDias(ultimoIso + 'T00:00:00', 1);
        const dias = [];
        for (let i = 0; i < 7; i++) dias.push(somarDias(inicio, i));
        await adicionarColunas(dias, 'append');
      } else {
        const primeiroIso = state.colunas[0];
        const fim = somarDias(primeiroIso + 'T00:00:00', -1);
        const dias = [];
        for (let i = 6; i >= 0; i--) dias.push(somarDias(fim, -i));
        const larguraAntes = gridScroll ? gridScroll.scrollWidth : 0;
        await adicionarColunas(dias, 'prepend');
        if (gridScroll) gridScroll.scrollLeft += (gridScroll.scrollWidth - larguraAntes);
      }
    } finally {
      state.carregandoMais = false;
    }
  }

  function atualizarIndicadorSync(isoForcado) {
    const header = $('#colunasHeaderConteudo');
    const indicador = $('#indicador-sync');
    if (!header || !header.children.length || !indicador) return;

    let alvo = isoForcado
      ? header.querySelector(`.col-header-dia[data-iso="${isoForcado}"]`)
      : null;

    if (!alvo && gridScroll) {
      const rect = gridScroll.getBoundingClientRect();
      const centro = rect.left + rect.width / 2;
      alvo = header.children[0];
      for (const col of header.children) {
        const r = col.getBoundingClientRect();
        if (r.left <= centro && r.right >= centro) { alvo = col; break; }
      }
      if (alvo && alvo.dataset.iso) {
        state.diaSelecionado = alvo.dataset.iso;
        $all('.col-header-dia').forEach(h => h.classList.toggle('dia-selecionado', h.dataset.iso === alvo.dataset.iso));
        $all('.coluna-dia').forEach(c => c.classList.toggle('coluna-selecionada', c.dataset.iso === alvo.dataset.iso));
      }
    }
    if (!alvo) return;

    const parent = $('#colunas-header');
    if (!parent) return;
    const rA = alvo.getBoundingClientRect();
    const rP = parent.getBoundingClientRect();
    indicador.style.left = `${rA.left - rP.left}px`;
    indicador.style.width = `${rA.width}px`;
    if (alvo && alvo.dataset.iso) atualizarOrientacaoGrade(alvo.dataset.iso);
  }

  function atualizarOcupacaoHeader() {
    // já calculado na criação do header; pode ser expandido depois
  }

  // ─── Filtros ───
  function aplicarFiltrosNaGrade() {
    $all('.coluna-dia').forEach(col => {
      const iso = col.dataset.iso;
      // remove blocos atuais
      col.querySelectorAll('.bloco-agendamento').forEach(b => b.remove());
      const lista = (state.agendamentosPorDia[iso] || []).filter(passaFiltros);
      lista.forEach((a, idx) => {
        const bloco = criarBlocoAgendamento(a, idx);
        if (bloco) col.appendChild(bloco);
      });
    });
  }

  function bindFiltros() {
    $all('[data-filtro-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filtros.status = btn.dataset.filtroStatus;
        $all('[data-filtro-status]').forEach(b => b.classList.toggle('filtro-ativo', b === btn));
        aplicarFiltrosNaGrade();
      });
    });
    $all('[data-filtro-origem]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filtros.origem = btn.dataset.filtroOrigem;
        $all('[data-filtro-origem]').forEach(b => b.classList.toggle('filtro-ativo', b === btn));
        aplicarFiltrosNaGrade();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Menu contextual + ações
  // ═══════════════════════════════════════════════════════════════
  const menuCtx = $('#menu-contextual');

  function abrirMenuContextual(evento, agendamento) {
    if (!menuCtx) return;
    state.contextoAtual = agendamento;
    menuCtx.classList.add('open');
    menuCtx.style.left = `${Math.min(evento.clientX, window.innerWidth - 210)}px`;
    menuCtx.style.top = `${Math.min(evento.clientY, window.innerHeight - 210)}px`;
  }

  document.addEventListener('click', (e) => {
    if (menuCtx && !menuCtx.contains(e.target)) menuCtx.classList.remove('open');
  });

  if (menuCtx) {
    menuCtx.querySelectorAll('.menu-ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const acao = item.dataset.acao;
        const a = state.contextoAtual;
        menuCtx.classList.remove('open');
        if (!a) return;
        if (acao === 'reagendar') abrirModalReagendar(a);
        else if (acao === 'editar') abrirModalAgendamento({ editar: true, agendamento: a });
        else if (acao === 'duplicar') duplicar(a);
        else if (acao === 'cancelar') cancelar(a);
      });
    });
  }

  async function duplicar(a) {
    const d = parseLocalDate(a.data_agendamento);
    if (isNaN(d.getTime())) return mostrarToast('Data inválida.', 'error');
    d.setDate(d.getDate() + 7);
    try {
      const res = await authFetch(`${API}/agendamentos/${a.id}/duplicar`, {
        method: 'POST',
        body: JSON.stringify({
          nova_data: `${formatarDataISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
        })
      });
      const data = await res.json();
      if (data.success) { mostrarToast('Agendamento duplicado.'); recarregarGridAtual(); }
      else mostrarToast(data.message || 'Erro ao duplicar.', 'error');
    } catch (e) {}
  }

  async function cancelar(a) {
    if (!confirm(`Cancelar o agendamento de ${a.nome || 'paciente'}?`)) return;
    try {
      const res = await authFetch(`${API}/agendamentos/${a.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { mostrarToast('Agendamento cancelado.'); recarregarGridAtual(); }
      else mostrarToast(data.message || 'Erro ao cancelar.', 'error');
    } catch (e) {}
  }

  async function reagendarViaDrop(id, novoIso, novaHora) {
    try {
      const res = await authFetch(`${API}/agendamentos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data_agendamento: `${novoIso} ${novaHora}:00` })
      });
      const data = await res.json();
      if (data.success) { mostrarToast('Agendamento reagendado.'); recarregarGridAtual(); }
      else mostrarToast(data.message || 'Não foi possível reagendar.', 'error');
    } catch (e) {}
  }

  function recarregarGridAtual() {
    if (!state.colunas.length) return;
    const data = parseLocalDate(state.colunas[0] + 'T00:00:00');
    if (isNaN(data.getTime())) return;
    carregarGradeInicial(inicioDaSemana(data));
  }

  // ═══════════════════════════════════════════════════════════════
  // Modais
  // ═══════════════════════════════════════════════════════════════
  function abrirModalReagendar(a) {
    const d = parseLocalDate(a.data_agendamento);
    if (isNaN(d.getTime())) return mostrarToast('Data inválida.', 'error');
    $('#rAgendamentoId').value = a.id;
    $('#rData').value = formatarDataISO(d) || '';
    $('#rHora').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    abrirModal('modalReagendar');
  }

  window.confirmarReagendamento = async function () {
    const id = $('#rAgendamentoId').value;
    const data = $('#rData').value;
    const hora = $('#rHora').value;
    if (!data || !hora) return mostrarToast('Informe data e horário.', 'error');

    const [hh, mm] = hora.split(':').map(Number);
    const snapped = minutosParaHoraStr(snapMinutos(hh * 60 + mm));
    const agOrig = Object.values(state.agendamentosPorDia).flat().find(x => String(x.id) === String(id));
    if (temConflito(data, snapped, obterDuracaoMinutos(agOrig || {}), id)) {
      return mostrarToast('Conflito de horário com outro agendamento.', 'error');
    }

    try {
      const res = await authFetch(`${API}/agendamentos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data_agendamento: `${data} ${snapped}:00` })
      });
      const resposta = await res.json();
      if (resposta.success) {
        mostrarToast('Agendamento reagendado.');
        fecharModal('modalReagendar');
        recarregarGridAtual();
      } else mostrarToast(resposta.message || 'Erro ao reagendar.', 'error');
    } catch (e) {}
  };

  function abrirModalAgendamento(opts) {
    const form = $('#formAgendamento');
    if (!form) return;
    form.reset();
    $('#fPacienteId').value = '';
    const sel = $('#fPacienteSelecionado');
    if (sel) sel.style.display = 'none';
    const res = $('#fResultadosPaciente');
    if (res) res.innerHTML = '';

    // profissional alvo (multi: da subcoluna; single: state)
    let uidAlvo = opts.usuarioId || (state.profissional && state.profissional.id);
    if (opts.editar && opts.agendamento) uidAlvo = opts.agendamento.usuario_id;
    form.dataset.usuarioId = uidAlvo || '';

    if (opts.novo) {
      $('#modalAgendamentoTitulo').textContent = 'Novo Agendamento';
      $('#fAgendamentoId').value = '';
      $('#fData').value = opts.data || '';
      $('#fHora').value = opts.hora || '';
    } else if (opts.editar) {
      const a = opts.agendamento;
      const d = parseLocalDate(a.data_agendamento);
      $('#modalAgendamentoTitulo').textContent = 'Editar Agendamento';
      $('#fAgendamentoId').value = a.id;
      $('#fData').value = formatarDataISO(d) || '';
      $('#fHora').value = isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      $('#fTipoTerapia').value = a.tipo_terapia || '';
      $('#fMotivo').value = a.motivo_consulta || '';
      $('#fBuscaPaciente').value = a.nome || '';
      $('#fPacienteId').value = a.paciente_id || '';
      if ($('#fDuracao')) $('#fDuracao').value = obterDuracaoMinutos(a);
    }
    abrirModal('modalAgendamento');
  }

  let buscaPacienteTimer = null;
  const fBusca = $('#fBuscaPaciente');
  if (fBusca) {
    fBusca.addEventListener('input', (e) => {
      const termo = e.target.value.trim();
      $('#fPacienteId').value = '';
      clearTimeout(buscaPacienteTimer);
      if (termo.length < 2) {
        const wrap = $('#fResultadosPaciente');
        if (wrap) wrap.innerHTML = '';
        return;
      }
      buscaPacienteTimer = setTimeout(() => buscarPacientes(termo), 350);
    });
  }

  let cachePacientes = null;
  async function obterCachePacientes() {
    if (cachePacientes) return cachePacientes;
    const res = await authFetch('/api/pacientes');
    const data = await res.json();
    cachePacientes = Array.isArray(data) ? data : (data.pacientes || []);
    return cachePacientes;
  }

  async function buscarPacientes(termo) {
    const wrap = $('#fResultadosPaciente');
    if (!wrap) return;
    try {
      const todos = await obterCachePacientes();
      const t = termo.trim().toLowerCase();
      const lista = todos.filter(p =>
        (p.nome || '').toLowerCase().includes(t) ||
        (p.telefone || '').replace(/\D/g, '').includes(t.replace(/\D/g, ''))
      );
      if (!lista.length) {
        wrap.innerHTML = `<p class="text-xs" style="color:rgba(148,163,184,0.5)">Nenhum paciente encontrado.</p>`;
        return;
      }
      wrap.innerHTML = lista.slice(0, 6).map(p => `
        <div class="py-2 px-3 text-xs rounded-lg cursor-pointer" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);margin-bottom:4px;"
             data-id="${p.id}" data-nome="${escapeHtml(p.nome)}">
          <strong style="color:#e2e8f0">${escapeHtml(p.nome)}</strong>
          <span style="color:rgba(148,163,184,0.5)"> — ${escapeHtml(p.telefone || '')}</span>
        </div>
      `).join('');
      wrap.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          $('#fPacienteId').value = item.dataset.id;
          $('#fBuscaPaciente').value = item.dataset.nome;
          wrap.innerHTML = '';
          const s = $('#fPacienteSelecionado');
          if (s) {
            s.style.display = 'block';
            s.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(item.dataset.nome)} selecionado`;
          }
        });
      });
    } catch (e) {
      wrap.innerHTML = `<p class="text-xs" style="color:#f87171">Erro ao buscar pacientes.</p>`;
    }
  }

  const formAgendamento = $('#formAgendamento');
  if (formAgendamento) {
    formAgendamento.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#fAgendamentoId').value;
      const pacienteId = $('#fPacienteId').value;
      const data = $('#fData').value;
      let hora = $('#fHora').value;
      const tipoTerapia = $('#fTipoTerapia').value;
      const motivo = $('#fMotivo').value;
      const duracaoCampo = $('#fDuracao') ? Number($('#fDuracao').value) : null;

      if (!pacienteId && !id) return mostrarToast('Selecione um paciente na busca.', 'error');
      if (!data || !hora) return mostrarToast('Informe data e horário.', 'error');

      // Snap na criação/edição
      const [hh, mm] = hora.split(':').map(Number);
      hora = minutosParaHoraStr(snapMinutos(hh * 60 + (mm || 0)));

      const duracao = duracaoCampo > 0 ? duracaoCampo : obterDuracaoMinutos({ tipo_terapia: tipoTerapia });
      if (temConflito(data, hora, duracao, id || null)) {
        return mostrarToast('Conflito de horário com outro agendamento.', 'error');
      }

      const payload = {
        data_agendamento: `${data} ${hora}:00`,
        tipo_terapia: tipoTerapia,
        motivo_consulta: motivo
      };
      if (duracaoCampo > 0) payload.duracao_minutos = duracaoCampo;

      try {
        let res, resposta;
        if (id) {
          res = await authFetch(`${API}/agendamentos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          payload.paciente_id = pacienteId;
          payload.usuario_id = (document.getElementById('formAgendamento') && document.getElementById('formAgendamento').dataset.usuarioId) || state.profissional.id;
          res = await authFetch(`${API}/agendamentos`, { method: 'POST', body: JSON.stringify(payload) });
        }
        resposta = await res.json();
        if (resposta.success) {
          mostrarToast(id ? 'Agendamento atualizado.' : 'Agendamento criado.');
          fecharModal('modalAgendamento');
          recarregarGridAtual();
        } else {
          mostrarToast(resposta.message || 'Erro ao salvar.', 'error');
        }
      } catch (err) {}
    });
  }

  function abrirModal(id) { $(`#${id}`)?.classList.add('open'); }
  window.fecharModal = function (id) { $(`#${id}`)?.classList.remove('open'); };

  // ═══════════════════════════════════════════════════════════════
  // Rodapé + atalhos de teclado
  // ═══════════════════════════════════════════════════════════════
  const btnFooterHoje = $('#btnFooterHoje');
  if (btnFooterHoje) {
    btnFooterHoje.addEventListener('click', async () => {
      if (!state.profissional) return mostrarToast('Selecione um profissional primeiro.', 'info');
      irParaHoje();
      setTimeout(abrirListaHoje, 400);
    });
  }

  async function abrirListaHoje() {
    try {
      const res = await authFetch(`${API}/hoje?profissionalId=${state.profissional.id}`);
      const data = await res.json();
      const lista = data.agendamentos || [];
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="flex items-center justify-between mb-4">
            <h3 class="modal-titulo">Agendamentos de hoje</h3>
            <button class="btn-voltar-camada w-8 h-8 flex items-center justify-center" id="fecharListaHoje"><i class="fas fa-times"></i></button>
          </div>
          ${lista.length ? lista.map(a => {
            const d = parseLocalDate(a.data_agendamento);
            const horaStr = isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `<div class="flex items-center justify-between py-3" style="border-bottom:1px solid var(--border)">
              <div>
                <p style="color:#e2e8f0;font-weight:700;font-size:13px;">${escapeHtml(a.nome || 'Paciente')}</p>
                <p style="color:rgba(148,163,184,0.5);font-size:11px;">${escapeHtml(a.tipo_terapia || '')}</p>
              </div>
              <span class="time-badge"><i class="fas fa-clock"></i> ${horaStr}</span>
            </div>`;
          }).join('') : `<p style="color:rgba(148,163,184,0.5);font-size:13px;text-align:center;padding:20px 0;">Nenhum agendamento para hoje.</p>`}
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#fecharListaHoje').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    } catch (e) {}
  }

  const btnFooterCalendarios = $('#btnFooterCalendarios');
  if (btnFooterCalendarios) {
    btnFooterCalendarios.addEventListener('click', () => {
      if (state.profissional) { mostrarCamada(2); carregarPanoramaAno(); }
      else mostrarCamada(1);
    });
  }

  const btnFooterEntrada = $('#btnFooterEntrada');
  if (btnFooterEntrada) {
    btnFooterEntrada.addEventListener('click', async () => {
      try {
        const [resLista, resContar] = await Promise.all([
          fetch('/api/notificacoes', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/notificacoes/contar', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const lista = resLista.ok ? await resLista.json() : [];
        if (resContar.ok) {
          const { total } = await resContar.json();
          const badge = $('#badgeEntrada');
          if (badge) {
            if (total > 0) { badge.textContent = total > 99 ? '99+' : total; badge.classList.remove('hidden'); }
            else badge.classList.add('hidden');
          }
        }
        document.querySelectorAll('.modal-entrada-overlay').forEach(el => el.remove());
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open modal-entrada-overlay';
        overlay.style.zIndex = '80';
        overlay.innerHTML = `
          <div class="modal-box" style="display:flex;flex-direction:column;max-height:min(88vh,640px);padding:0;overflow:hidden;">
            <div class="flex items-center justify-between px-5 pt-5 pb-3" style="flex-shrink:0;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(10,18,24,0.98);z-index:2;">
              <h3 class="modal-titulo" style="font-size:16px;">Entrada — Portal do Paciente</h3>
              <button type="button" class="btn-voltar-camada w-9 h-9 flex items-center justify-center" id="fecharEntrada"><i class="fas fa-times"></i></button>
            </div>
            <div class="px-5 py-3" style="overflow-y:auto;flex:1;">
              ${lista.length ? lista.map(n => `
                <div class="flex items-start gap-3 py-3" style="border-bottom:1px solid var(--border)">
                  <i class="fas fa-bell mt-1" style="color:var(--cyan);"></i>
                  <div>
                    <p style="color:#e2e8f0;font-weight:700;font-size:13px;">${escapeHtml(n.titulo || '')}</p>
                    <p style="color:rgba(148,163,184,0.55);font-size:12px;">${escapeHtml(n.mensagem || '')}</p>
                  </div>
                </div>`).join('') : `<p style="color:rgba(148,163,184,0.5);text-align:center;padding:28px 0;">Nenhuma notificação.</p>`}
            </div>
          </div>`;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        const fechar = () => { overlay.remove(); document.body.style.overflow = ''; };
        overlay.querySelector('#fecharEntrada').addEventListener('click', fechar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
      } catch (err) { console.error(err); }
    });
  }

  // Atalhos de teclado (mercado)
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Escape') {
      $all('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      menuCtx?.classList.remove('open');
      return;
    }
    if (!state.profissional) return;

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      irParaHoje();
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      if (!document.querySelector('#camada4.ativa')) return;
      const iso = state.diaSelecionado || formatarDataISO(new Date());
      abrirModalAgendamento({ novo: true, data: iso, hora: '09:00' });
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      ativarModoMulti(!state.modoMulti);
    }
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      const inp = $('#inputIrParaData');
      if (inp) { inp.showPicker ? inp.showPicker() : inp.click(); }
    }
    if (e.key === 'ArrowLeft' && document.querySelector('#camada4.ativa')) {
      e.preventDefault();
      if (gridScroll) gridScroll.scrollLeft -= COL_LARGURA;
    }
    if (e.key === 'ArrowRight' && document.querySelector('#camada4.ativa')) {
      e.preventDefault();
      if (gridScroll) gridScroll.scrollLeft += COL_LARGURA;
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // CSS dinâmico extra (filtros, ocupação, status, duração)
  // ═══════════════════════════════════════════════════════════════
  (function injetarCSSExtra() {
    if (document.getElementById('agenda-avancada-v3-css')) return;
    const style = document.createElement('style');
    style.id = 'agenda-avancada-v3-css';
    style.textContent = `
      #barraFiltrosGrade {
        display: none; flex-wrap: wrap; gap: 8px; align-items: center;
        margin-bottom: 12px; padding: 8px 0;
      }
      .filtro-chip {
        font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 99px;
        background: rgba(255,255,255,0.04); border: 1px solid var(--border);
        color: rgba(148,163,184,0.7); cursor: pointer; transition: all 0.2s;
      }
      .filtro-chip:hover { border-color: rgba(52,211,153,0.35); color: var(--emerald); }
      .filtro-chip.filtro-ativo {
        background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.4); color: var(--emerald);
      }
      .col-ocupacao {
        font-size: 9px; font-weight: 800; color: var(--cyan);
        background: rgba(34,211,238,0.12); border-radius: 99px; padding: 1px 6px; margin-top: 4px; display: inline-block;
      }
      .col-header-dia.dia-selecionado { background: rgba(52,211,153,0.1); }
      .coluna-dia.coluna-selecionada { background: rgba(52,211,153,0.03); }
      .bloco-agendamento.arrastando { opacity: 0.5; }
      .bloco-agendamento .bloco-tipo {
        font-size: 9px; font-weight: 600; opacity: 0.65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .bloco-agendamento.status-confirmado { box-shadow: 0 0 0 1px rgba(5,150,105,0.5); }
      .mes-dia-cel.media { background: rgba(34,211,238,0.08); }
      .mes-dia-cel.alta { background: rgba(52,211,153,0.15); }
      #selectProfissionalRapido {
        background: rgba(255,255,255,0.04); border: 1px solid var(--border);
        border-radius: 10px; color: #e2e8f0; font-size: 12px; padding: 6px 10px; max-width: 160px;
      }
      @media (max-width: 767px) {
        #selectProfissionalRapido { max-width: 120px; font-size: 11px; }
      }
      #barraMultiProf { display:none; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px; }
      #btnToggleMulti { font-size:11px; font-weight:700; padding:6px 12px; border-radius:99px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:rgba(148,163,184,0.7); cursor:pointer; }
      #btnToggleMulti.filtro-ativo { background:rgba(52,211,153,0.15); border-color:rgba(52,211,153,0.4); color:var(--emerald); }
      .chip-prof { font-size:11px; font-weight:700; padding:5px 10px; border-radius:99px; background:rgba(255,255,255,0.03); border:1px solid var(--border); color:rgba(148,163,184,0.5); cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
      .chip-prof.chip-ativo { color:#e2e8f0; }
      .chip-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
      .sub-headers-row { display:flex; margin-top:6px; }
      .sub-header-prof { flex:1; font-size:9px; font-weight:800; text-align:center; color:rgba(226,232,240,0.7); padding-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .coluna-multi { overflow:hidden; }
      .subcols-row { min-height:calc(24 * 64px); display:flex; }
      .subcoluna-prof { position:relative; }
      .dia-hoje-tag {
        font-size: 9px; font-weight: 800; color: var(--slate-bg, #020c12);
        background: var(--emerald); border-radius: 99px; padding: 1px 8px;
        display: inline-block; margin-top: 4px;
      }
      #labelFaixaSemana {
        font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700;
        color: #e2e8f0; letter-spacing: 0.02em;
      }
      #badgeDiaFlutuante {
        position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
        z-index: 8; display: none; align-items: center; gap: 8px;
        padding: 8px 16px; border-radius: 99px;
        background: rgba(8,18,26,0.92); border: 1px solid rgba(52,211,153,0.35);
        color: #f1f5f9; font-family: 'Space Grotesk', sans-serif;
        font-size: 13px; font-weight: 700;
        box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 16px rgba(52,211,153,0.15);
        pointer-events: none; backdrop-filter: blur(12px);
      }
      #badgeDiaFlutuante.badge-hoje {
        border-color: rgba(52,211,153,0.6);
        box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 20px rgba(52,211,153,0.3);
      }
      #btnAtalhos {
        font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 99px;
        background: rgba(255,255,255,0.04); border: 1px solid var(--border);
        color: rgba(148,163,184,0.7); cursor: pointer;
      }
      #btnAtalhos:hover { border-color: rgba(34,211,238,0.4); color: var(--cyan); }
      #painelAtalhos {
        display: none; position: fixed; right: 16px; top: 72px; z-index: 9999;
        width: min(320px, calc(100vw - 24px));
        background: rgba(8,18,26,0.98); border: 1px solid var(--border);
        border-radius: 16px; padding: 14px 16px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.5); backdrop-filter: blur(16px);
      }
      #painelAtalhos.open { display: block; }
      #painelAtalhos h4 {
        margin: 0 0 10px; font-family: 'Space Grotesk', sans-serif;
        font-size: 13px; color: #f1f5f9;
      }
      .atalho-linha {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(148,163,184,0.08);
        font-size: 12px; color: rgba(203,213,225,0.85);
      }
      .atalho-linha:last-child { border-bottom: none; }
      .atalho-tecla {
        font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 800;
        color: var(--emerald); background: rgba(52,211,153,0.12);
        border: 1px solid rgba(52,211,153,0.3); border-radius: 8px;
        padding: 3px 8px; white-space: nowrap;
      }
      .col-header-dia .dia-semana {
        font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
        color: rgba(226,232,240,0.85);
      }
      .col-header-dia.hoje-col .dia-semana { color: var(--emerald); }
      #orientacaoGrade {
        display: none; align-items: center; justify-content: space-between;
        gap: 12px; margin-bottom: 10px; flex-wrap: wrap;
      }
      #orientacaoGrade.visivel { display: flex; }
      .orientacao-acoes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .btn-ir-data {
        position: relative; display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 99px;
        background: rgba(255,255,255,0.04); border: 1px solid var(--border);
        color: rgba(148,163,184,0.85); cursor: pointer;
      }
      .btn-ir-data:hover { border-color: rgba(34,211,238,0.4); color: var(--cyan); }
      .btn-ir-data input[type="date"] {
        position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
      }
      .col-header-dia.sep-mes-header {
        border-left: 2px solid rgba(34,211,238,0.45) !important;
        box-shadow: inset 3px 0 0 rgba(34,211,238,0.12);
      }
      .coluna-dia.sep-mes-coluna {
        border-left: 2px solid rgba(34,211,238,0.35) !important;
      }
      .sep-mes-label {
        position: absolute; top: 8px; left: 6px; z-index: 6;
        font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--cyan); background: rgba(8,18,26,0.9);
        border: 1px solid rgba(34,211,238,0.35); border-radius: 8px;
        padding: 3px 8px; pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      }
      #grid-scroll { scroll-behavior: smooth; }
      #colunas-header, #colunasHeaderConteudo { cursor: grab; user-select: none; }
      #colunas-header.header-dragging, .header-dragging { cursor: grabbing !important; }
      .celula-hora {
        background: rgba(255,255,255,0.015);
        border-bottom: 1px solid rgba(148,163,184,0.1) !important;
        transition: background 0.15s, box-shadow 0.15s;
      }
      .celula-hora:nth-child(even) {
        background: rgba(34,211,238,0.03);
      }
      .celula-hora:nth-child(odd) {
        background: rgba(52,211,153,0.025);
      }
      .coluna-dia:nth-child(even) .celula-hora:nth-child(odd) {
        background: rgba(251,191,36,0.04);
      }
      .coluna-dia:nth-child(even) .celula-hora:nth-child(even) {
        background: rgba(255,255,255,0.02);
      }
      .celula-hora:hover {
        background: rgba(52,211,153,0.12) !important;
        box-shadow: inset 0 0 0 1px rgba(52,211,153,0.35);
      }
      .celula-hora.drop-hover {
        background: rgba(34,211,238,0.18) !important;
        box-shadow: inset 0 0 0 1px rgba(34,211,238,0.5);
      }
      .coluna-dia {
        background: rgba(255,255,255,0.01);
      }
      .coluna-dia.coluna-selecionada {
        background: rgba(52,211,153,0.06) !important;
        box-shadow: inset 0 0 0 1px rgba(52,211,153,0.2);
      }
      .hora-linha:nth-child(even) {
        background: rgba(34,211,238,0.04);
        color: rgba(148,163,184,0.65);
      }
      .popup-celula {
        position: fixed; z-index: 220; width: min(280px, calc(100vw - 16px));
        background: rgba(8,18,26,0.98); border: 1px solid rgba(52,211,153,0.35);
        border-radius: 16px; padding: 12px 14px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.55), 0 0 24px rgba(52,211,153,0.12);
        backdrop-filter: blur(16px); color: #e2e8f0;
      }
      .popup-celula-cab {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
        margin-bottom: 6px; font-size: 14px;
      }
      .popup-celula-cab strong { color: #f1f5f9; font-family: 'Space Grotesk', sans-serif; }
      .popup-mes { color: rgba(148,163,184,0.75); font-size: 12px; }
      .popup-x {
        background: rgba(255,255,255,0.05); border: 1px solid var(--border);
        border-radius: 8px; width: 28px; height: 28px; color: rgba(148,163,184,0.8);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      .popup-celula-hora {
        font-size: 12px; font-weight: 700; color: var(--cyan); margin-bottom: 10px;
        display: flex; align-items: center; gap: 6px;
      }
      .popup-vazio { font-size: 12px; color: rgba(148,163,184,0.55); margin: 8px 0; }
      .popup-ag-item {
        padding: 8px 10px; border-radius: 10px; margin-bottom: 6px; cursor: pointer;
        background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2);
      }
      .popup-ag-item:hover { background: rgba(52,211,153,0.15); }
      .popup-ag-nome { font-size: 13px; font-weight: 700; color: #f1f5f9; }
      .popup-ag-meta { font-size: 11px; color: rgba(148,163,184,0.7); margin-top: 2px; }
      .popup-btn-prim {
        width: 100%; margin-top: 8px; padding: 10px; border: none; border-radius: 12px;
        font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12px;
        color: #fff; cursor: pointer;
        background: linear-gradient(135deg, #0891b2 0%, #059669 100%);
      }
      .popup-btn-prim:hover { box-shadow: 0 0 20px rgba(8,145,178,0.45); }
    
      /* Altura dobrada das células / linhas de hora */
      .hora-linha, .celula-hora {
        height: 120px !important;
        min-height: 120px;
      }
      .coluna-horas, #colunaHoras {
        height: calc(24 * 120px) !important;
      }
      .coluna-dia, .subcols-row {
        min-height: calc(24 * 120px) !important;
      }
      /* Chip de data no canto (estilo filtro, menor) */
      .celula-hora .cel-corner {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 2;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: rgba(52, 211, 153, 0.75);
        background: rgba(52, 211, 153, 0.08);
        border: 1px solid rgba(52, 211, 153, 0.22);
        border-radius: 99px;
        padding: 2px 6px;
        line-height: 1.2;
        pointer-events: none;
        font-family: 'Space Grotesk', sans-serif;
        white-space: nowrap;
      }
      .coluna-dia.coluna-selecionada .celula-hora .cel-corner {
        color: var(--emerald);
        background: rgba(52, 211, 153, 0.16);
        border-color: rgba(52, 211, 153, 0.4);
      }
      .col-header-dia.hoje-col ~ * .cel-corner,
      .coluna-dia[data-iso].hoje-col .cel-corner { }
      /* Blocos adaptam ao conteúdo */
      .bloco-agendamento {
        min-height: 40px;
        padding: 6px 8px !important;
        overflow: hidden;
      }
      .bloco-agendamento .bloco-nome {
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.25;
      }
      .bloco-agendamento .bloco-hora {
        font-size: 10px;
        margin-bottom: 2px;
      }
`;
    document.head.appendChild(style);
  })();

  // ═══════════════════════════════════════════════════════════════
  // Injetar barra de filtros + select rápido no DOM (sem exigir HTML novo)
  // ═══════════════════════════════════════════════════════════════
  (function montarUIExtra() {
    const header = $('#agenda-header');
    if (header && !$('#selectProfissionalRapido')) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
      wrap.innerHTML = `<select id="selectProfissionalRapido" title="Trocar profissional"></select>`;
      // insere antes do botão Hoje se existir
      const btnHoje = $('#btnHojeHeader');
      if (btnHoje && btnHoje.parentNode) btnHoje.parentNode.insertBefore(wrap, btnHoje);
      else header.appendChild(wrap);
    }

    const conteudo = $('#conteudo-scroll');
    if (conteudo && !$('#barraMultiProf')) {
      const multi = document.createElement('div');
      multi.id = 'barraMultiProf';
      multi.innerHTML = '<button type="button" id="btnToggleMulti"><i class="fas fa-user"></i> Multi</button><div id="chipsMultiProf" style="display:none;flex-wrap:wrap;gap:6px;"></div>';
      const c4 = $('#camada4');
      if (c4 && c4.parentNode) c4.parentNode.insertBefore(multi, c4);
      else conteudo.insertBefore(multi, conteudo.firstChild);
      const btnM = $('#btnToggleMulti');
      if (btnM) btnM.addEventListener('click', () => ativarModoMulti(!state.modoMulti));
    }

    if (conteudo && !$('#barraFiltrosGrade')) {
      const barra = document.createElement('div');
      barra.id = 'barraFiltrosGrade';
      barra.innerHTML = `
        <span style="font-size:10px;font-weight:800;color:rgba(148,163,184,0.45);text-transform:uppercase;letter-spacing:0.06em;margin-right:4px;">Filtros</span>
        <button type="button" class="filtro-chip filtro-ativo" data-filtro-status="todos">Todos</button>
        <button type="button" class="filtro-chip" data-filtro-status="aguardando_sinal">Aguardando</button>
        <button type="button" class="filtro-chip" data-filtro-status="confirmado">Confirmado</button>
        <button type="button" class="filtro-chip" data-filtro-status="cancelado">Cancelado</button>
        <span style="width:1px;height:16px;background:var(--border);margin:0 4px;"></span>
        <button type="button" class="filtro-chip filtro-ativo" data-filtro-origem="todos">Origem</button>
        <button type="button" class="filtro-chip" data-filtro-origem="recepcao">Recepção</button>
        <button type="button" class="filtro-chip" data-filtro-origem="portal">Portal</button>
      `;
      // inserir antes da camada 4 se possível
      const c4 = $('#camada4');
      if (c4 && c4.parentNode) c4.parentNode.insertBefore(barra, c4);
      else conteudo.insertBefore(barra, conteudo.firstChild);
      bindFiltros();
    }

    // Campo duração opcional no modal (se ainda não existir)
    const form = $('#formAgendamento');
    if (form && !$('#fDuracao')) {
      const tipoField = $('#fTipoTerapia');
      if (tipoField && tipoField.parentNode) {
        const div = document.createElement('div');
        div.innerHTML = `
          <label class="modal-campo-label">Duração (minutos)</label>
          <input type="number" id="fDuracao" class="modal-input" min="10" max="240" step="5" placeholder="Ex: 50" value="${DURACAO_PADRAO}">
        `;
        tipoField.parentNode.parentNode.insertBefore(div, tipoField.parentNode.nextSibling);
      }
    }

    // Orientação de dia + atalhos de teclado
    if ($('#camada4') && !$('#orientacaoGrade')) {
      const ori = document.createElement('div');
      ori.id = 'orientacaoGrade';
      ori.innerHTML = [
        '<div id="labelFaixaSemana">—</div>',
        '<div class="orientacao-acoes">',
        '<label class="btn-ir-data" title="Ir para data">',
        '<i class="fas fa-calendar-day"></i>',
        '<span>Ir para data</span>',
        '<input type="date" id="inputIrParaData" aria-label="Escolher data">',
        '</label>',
        '<button type="button" id="btnAtalhos" title="Atalhos de teclado"><i class="fas fa-keyboard"></i> Atalhos</button>',
        '</div>'
      ].join('');
      const c4 = $('#camada4');
      if (c4 && c4.parentNode) c4.parentNode.insertBefore(ori, c4);
      const inputData = $('#inputIrParaData');
      if (inputData) {
        inputData.addEventListener('change', () => {
          const v = inputData.value;
          if (v) irParaData(v);
        });
      }
    }
    if ($('#grid-wrap') && !$('#badgeDiaFlutuante')) {
      const badge = document.createElement('div');
      badge.id = 'badgeDiaFlutuante';
      badge.setAttribute('aria-live', 'polite');
      const gw = $('#grid-wrap');
      if (getComputedStyle(gw).position === 'static') gw.style.position = 'relative';
      gw.appendChild(badge);
    }
    if (!$('#painelAtalhos')) {
      const painel = document.createElement('div');
      painel.id = 'painelAtalhos';
      painel.innerHTML = [
        '<h4><i class="fas fa-keyboard"></i> Atalhos da Agenda</h4>',
        '<div class="atalho-linha"><span>Ligar / desligar multi-profissional</span><span class="atalho-tecla">M</span></div>',
        '<div class="atalho-linha"><span>Ir para hoje</span><span class="atalho-tecla">T</span></div>',
        '<div class="atalho-linha"><span>Novo agendamento</span><span class="atalho-tecla">N</span></div>',
        '<div class="atalho-linha"><span>Rolar a grade (dias)</span><span class="atalho-tecla">← →</span></div>',
        '<div class="atalho-linha"><span>Ir para data</span><span class="atalho-tecla">G</span></div>',
        '<div class="atalho-linha"><span>Ir para data</span><span class="atalho-tecla">G</span></div>',
        '<div class="atalho-linha"><span>Fechar modal ou menu</span><span class="atalho-tecla">Esc</span></div>'
      ].join('');
      const host = $('#agenda-header') || document.body;
      host.appendChild(painel);
      document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('#btnAtalhos');
        if (btn) {
          e.stopPropagation();
          painel.classList.toggle('open');
          return;
        }
        if (!painel.contains(e.target)) painel.classList.remove('open');
      });
    }
  })();

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════
  if (!token) {
    mostrarToast('Sessão não encontrada. Faça login novamente.', 'error');
  } else {
    carregarProfissionais();
  }
})();
