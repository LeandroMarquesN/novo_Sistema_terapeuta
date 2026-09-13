/* =============================================================================
   AgendaAvancadaScript.js
   Lógica client-side da Agenda Avançada (agendaAvancada.html) — MedLM
   Camada 1: Profissionais | Camada 2: Panorama Anual | Camada 3: Mês | Camada 4: Grade

   Correções principais (v2):
   - Parsing de datas LOCAL (sem shift UTC → evita NaN e dia anterior)
   - Proteção contra datas inválidas nos blocos e na grade
   - Evita colunas duplicadas no scroll infinito
   - Sincronização do indicador e seleção de dia mais estável
   ============================================================================= */
(function () {
  'use strict';

  const API = '/api/agenda-avancada';
  const token = localStorage.getItem('token');
  const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const HORA_ALTURA = 64; // px — precisa bater com .hora-linha / .celula-hora no CSS
  const COL_LARGURA = 160; // px — precisa bater com --col-width

  const state = {
    profissional: null,
    ano: new Date().getFullYear(),
    mesAtual: { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 },
    colunas: [],           // array de 'YYYY-MM-DD' atualmente renderizadas na Camada 4
    agendamentosPorDia: {}, // cache: 'YYYY-MM-DD' -> [agendamentos]
    carregandoMais: false,
    contextoAtual: null,   // agendamento selecionado no menu contextual
    diaSelecionado: null
  };

  // ═══════════════════════════════════════════════════════════════
  // Helpers gerais
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

  // ─── Helpers de data robustos (evita NaN e shift de timezone) ───
  function formatarDataISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * Converte string 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:mm:ss' (ou Date)
   * em Date LOCAL, sem interpretação UTC.
   * Isso elimina o bug clássico do dia anterior no fuso do Brasil.
   */
  function parseLocalDate(valor) {
    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return new Date(valor.getTime());
    }
    if (typeof valor !== 'string') return new Date(NaN);

    const match = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return new Date(NaN);

    const [, y, m, d, h = '0', min = '0', s = '0'] = match;
    return new Date(+y, +m - 1, +d, +h, +min, +s);
  }

  function inicioDaSemana(data) {
    const d = parseLocalDate(data);
    if (isNaN(d.getTime())) return new Date();
    const diaSemana = d.getDay(); // 0 = domingo
    d.setDate(d.getDate() - diaSemana);
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
    const hoje = new Date();
    return d.getFullYear() === hoje.getFullYear()
      && d.getMonth() === hoje.getMonth()
      && d.getDate() === hoje.getDate();
  }

  function corPastel(idx) {
    const cores = ['cor-azul', 'cor-verde', 'cor-laranja', 'cor-roxo'];
    return cores[idx % cores.length];
  }

  function iniciais(nome) {
    return (nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
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
        card.addEventListener('click', () => {
          state.profissional = { id: card.dataset.id, nome: card.dataset.nome };
          const titulo = $('#tituloProfissional');
          if (titulo) {
            titulo.innerHTML = `${escapeHtml(card.dataset.nome)} <span class="separator">|</span> <span style="color:var(--emerald)">Agenda</span>`;
          }
          mostrarCamada(2);
          carregarPanoramaAno();
        });
      });
    } catch (err) {
      wrap.innerHTML = `<div class="col-span-full text-center py-10" style="color:#f87171">Erro ao carregar profissionais.</div>`;
    }
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
        (data.dias || [])
          .map(d => formatarDataISO(parseLocalDate(d.dia)))
          .filter(Boolean)
      );

      grid.innerHTML = '';
      for (let mes = 1; mes <= 12; mes++) {
        grid.appendChild(criarCardMes(mes, diasComAgenda));
      }
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

    card.innerHTML = `
      <p class="mes-card-titulo mb-3">${MESES[mes - 1]}</p>
      <div class="grid grid-cols-7 gap-0.5">${cells}</div>
    `;
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
        html += `<div class="mes-dia-cel ${ehHoje(d) ? 'hoje' : ''}" data-iso="${iso}">
          <span>${dia}</span>${total ? `<span class="contador">${total}</span>` : ''}
        </div>`;
      }
      grid.innerHTML = html;

      grid.querySelectorAll('.mes-dia-cel[data-iso]').forEach(cel => {
        cel.addEventListener('click', () => {
          const dataClicada = parseLocalDate(cel.dataset.iso + 'T00:00:00');
          if (isNaN(dataClicada.getTime())) {
            mostrarToast('Data inválida.', 'error');
            return;
          }
          mostrarCamada(4);
          carregarGradeInicial(inicioDaSemana(dataClicada));
        });
      });
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-10" style="color:#f87171">Erro ao carregar o mês.</div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMADA 4 — Grade de colunas infinitas
  // ═══════════════════════════════════════════════════════════════
  function montarColunaHoras() {
    const col = $('#colunaHoras');
    if (!col) return;
    let html = '';
    for (let h = 0; h < 24; h++) {
      html += `<div class="hora-linha">${String(h).padStart(2, '0')}:00</div>`;
    }
    col.innerHTML = html;
  }
  montarColunaHoras();

  async function carregarGradeInicial(dataInicioSemana) {
    state.colunas = [];
    state.agendamentosPorDia = {};
    const header = $('#colunasHeaderConteudo');
    const dias = $('#colunasDiasConteudo');
    const lembretes = $('#faixaLembretesConteudo');
    if (header) header.innerHTML = '';
    if (dias) dias.innerHTML = '';
    if (lembretes) lembretes.innerHTML = '';

    const listaDias = [];
    for (let i = 0; i < 7; i++) listaDias.push(somarDias(dataInicioSemana, i));
    await adicionarColunas(listaDias, 'append');

    const scroll = $('#grid-scroll');
    if (scroll) scroll.scrollLeft = 0;
    atualizarIndicadorSync();
  }

  async function adicionarColunas(dias, modo) {
    const isos = dias.map(d => formatarDataISO(d)).filter(Boolean);
    if (!isos.length) return;

    const inicio = isos[0];
    const fim = isos[isos.length - 1] + ' 23:59:59';

    let agendamentosPorDia = {};
    try {
      const res = await authFetch(
        `${API}/grade?profissionalId=${state.profissional.id}&inicio=${inicio}&fim=${encodeURIComponent(fim)}`
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
      if (!iso) return;

      // Evita colunas duplicadas (causa comum de grade "incompleta"/bugada)
      if (state.colunas.includes(iso)) return;

      state.agendamentosPorDia[iso] = agendamentosPorDia[iso] || [];

      const headerCel = document.createElement('div');
      headerCel.className = `col-header-dia ${ehHoje(d) ? 'hoje-col' : ''}`;
      headerCel.dataset.iso = iso;
      headerCel.innerHTML = `
        <div class="dia-semana">${DIAS_SEMANA[d.getDay()]}</div>
        <div class="dia-numero">${d.getDate()}</div>
      `;
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

    // Mantém ordem cronológica
    state.colunas.sort();
  }

  function criarColunaDia(iso, agendamentos) {
    const col = document.createElement('div');
    col.className = 'coluna-dia';
    col.dataset.iso = iso;

    let cells = '';
    for (let h = 0; h < 24; h++) {
      cells += `<div class="celula-hora" data-hora="${h}"></div>`;
    }
    col.innerHTML = cells;

    (agendamentos || []).forEach((a, idx) => {
      const bloco = criarBlocoAgendamento(a, idx);
      if (bloco) col.appendChild(bloco);
    });

    col.addEventListener('click', () => selecionarDiaColuna(iso), true);

    col.querySelectorAll('.celula-hora').forEach(cel => {
      cel.addEventListener('click', (e) => {
        if (e.target !== cel) return;
        selecionarDiaColuna(iso);
        const hora = String(cel.dataset.hora || '0').padStart(2, '0');
        abrirModalAgendamento({ novo: true, data: iso, hora: `${hora}:00` });
      });
      cel.addEventListener('dragover', (e) => {
        e.preventDefault();
        cel.classList.add('drop-hover');
      });
      cel.addEventListener('dragleave', () => cel.classList.remove('drop-hover'));
      cel.addEventListener('drop', (e) => {
        e.preventDefault();
        cel.classList.remove('drop-hover');
        const agendamentoId = e.dataTransfer.getData('text/agendamento-id');
        if (!agendamentoId) return;
        const hora = String(cel.dataset.hora || '0').padStart(2, '0');
        reagendarViaDrop(agendamentoId, iso, `${hora}:00`);
      });
    });

    return col;
  }

  function selecionarDiaColuna(iso) {
    if (!iso) return;
    state.diaSelecionado = iso;
    $all('.col-header-dia').forEach(h => {
      h.classList.toggle('dia-selecionado', h.dataset.iso === iso);
    });
    $all('.coluna-dia').forEach(c => {
      c.classList.toggle('coluna-selecionada', c.dataset.iso === iso);
    });
    atualizarIndicadorSync(iso);
  }

  function criarBlocoAgendamento(a, idx) {
    const d = parseLocalDate(a.data_agendamento);
    if (isNaN(d.getTime())) {
      console.warn('[AgendaAvançada] Data inválida no agendamento', a.id, a.data_agendamento);
      return null;
    }

    const minutosDoDia = d.getHours() * 60 + d.getMinutes();
    const duracaoPx = 56; // ~50 min — futuro: usar duração real do tipo
    const topPx = (minutosDoDia / 60) * HORA_ALTURA;

    if (isNaN(topPx)) {
      console.warn('[AgendaAvançada] topPx NaN', a.id, minutosDoDia);
      return null;
    }

    const div = document.createElement('div');
    const cancelado = a.status_agendamento === 'cancelado';
    const origemClasse = a.origem_paciente === 'portal' ? 'origem-portal' : 'origem-recepcao';

    div.className = `bloco-agendamento ${corPastel(idx)} ${origemClasse} ${cancelado ? 'cancelado-bloco' : ''}`;
    div.style.top = `${topPx}px`;
    div.style.height = `${duracaoPx}px`;
    div.dataset.id = a.id;
    div.draggable = !cancelado;

    div.innerHTML = `
      <div class="bloco-hora">${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</div>
      <div class="bloco-nome">${escapeHtml(a.nome || 'Paciente')}</div>
    `;

    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/agendamento-id', String(a.id));
    });

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirMenuContextual(e, a);
    });

    return div;
  }

  // ─── Scroll infinito horizontal ───
  const gridScroll = $('#grid-scroll');
  if (gridScroll) {
    gridScroll.addEventListener('scroll', () => {
      atualizarIndicadorSync();
      if (state.carregandoMais || !state.profissional || !state.colunas.length) return;

      const proximoDoFim = gridScroll.scrollWidth - (gridScroll.scrollLeft + gridScroll.clientWidth);
      if (proximoDoFim < COL_LARGURA * 2) {
        carregarMaisColunas('proxima');
      } else if (gridScroll.scrollLeft < COL_LARGURA * 2) {
        carregarMaisColunas('anterior');
      }
    });
  }

  async function carregarMaisColunas(direcao) {
    if (state.carregandoMais || !state.profissional || !state.colunas.length) return;
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
        if (gridScroll) {
          gridScroll.scrollLeft += (gridScroll.scrollWidth - larguraAntes);
        }
      }
    } finally {
      state.carregandoMais = false;
    }
  }

  function atualizarIndicadorSync(isoForcado) {
    const header = $('#colunasHeaderConteudo');
    const indicador = $('#indicador-sync');
    if (!header || !header.children.length || !indicador) return;

    let alvo = null;
    if (isoForcado) {
      alvo = header.querySelector(`.col-header-dia[data-iso="${isoForcado}"]`);
    }
    if (!alvo && gridScroll) {
      const scrollWrapRect = gridScroll.getBoundingClientRect();
      const centro = scrollWrapRect.left + scrollWrapRect.width / 2;
      alvo = header.children[0];
      for (const col of header.children) {
        const rect = col.getBoundingClientRect();
        if (rect.left <= centro && rect.right >= centro) {
          alvo = col;
          break;
        }
      }
      if (alvo && alvo.dataset.iso) {
        state.diaSelecionado = alvo.dataset.iso;
        $all('.col-header-dia').forEach(h => {
          h.classList.toggle('dia-selecionado', h.dataset.iso === alvo.dataset.iso);
        });
        $all('.coluna-dia').forEach(c => {
          c.classList.toggle('coluna-selecionada', c.dataset.iso === alvo.dataset.iso);
        });
      }
    }
    if (!alvo) return;

    const headerParent = $('#colunas-header');
    if (!headerParent) return;
    const rectAlvo = alvo.getBoundingClientRect();
    const rectParent = headerParent.getBoundingClientRect();
    indicador.style.left = `${rectAlvo.left - rectParent.left}px`;
    indicador.style.width = `${rectAlvo.width}px`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Menu contextual
  // ═══════════════════════════════════════════════════════════════
  const menuCtx = $('#menu-contextual');

  function abrirMenuContextual(evento, agendamento) {
    if (!menuCtx) return;
    state.contextoAtual = agendamento;
    menuCtx.classList.add('open');
    const x = Math.min(evento.clientX, window.innerWidth - 210);
    const y = Math.min(evento.clientY, window.innerHeight - 210);
    menuCtx.style.left = `${x}px`;
    menuCtx.style.top = `${y}px`;
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
    if (isNaN(d.getTime())) {
      mostrarToast('Data do agendamento original inválida.', 'error');
      return;
    }
    d.setDate(d.getDate() + 7);
    try {
      const res = await authFetch(`${API}/agendamentos/${a.id}/duplicar`, {
        method: 'POST',
        body: JSON.stringify({
          nova_data: `${formatarDataISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
        })
      });
      const data = await res.json();
      if (data.success) {
        mostrarToast('Agendamento duplicado.');
        recarregarGridAtual();
      } else {
        mostrarToast(data.message || 'Erro ao duplicar.', 'error');
      }
    } catch (err) { /* authFetch já trata 401 */ }
  }

  async function cancelar(a) {
    if (!confirm(`Cancelar o agendamento de ${a.nome || 'paciente'}?`)) return;
    try {
      const res = await authFetch(`${API}/agendamentos/${a.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        mostrarToast('Agendamento cancelado.');
        recarregarGridAtual();
      } else {
        mostrarToast(data.message || 'Erro ao cancelar.', 'error');
      }
    } catch (err) { /* authFetch já trata 401 */ }
  }

  async function reagendarViaDrop(id, novoIso, novaHora) {
    try {
      const res = await authFetch(`${API}/agendamentos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data_agendamento: `${novoIso} ${novaHora}:00` })
      });
      const data = await res.json();
      if (data.success) {
        mostrarToast('Agendamento reagendado.');
        recarregarGridAtual();
      } else {
        mostrarToast(data.message || 'Não foi possível reagendar.', 'error');
      }
    } catch (err) { /* authFetch já trata 401 */ }
  }

  function recarregarGridAtual() {
    if (!state.colunas.length) return;
    const primeiroIso = state.colunas[0];
    const data = parseLocalDate(primeiroIso + 'T00:00:00');
    if (isNaN(data.getTime())) return;
    carregarGradeInicial(inicioDaSemana(data));
  }

  // ═══════════════════════════════════════════════════════════════
  // Modal: Reagendar rápido
  // ═══════════════════════════════════════════════════════════════
  function abrirModalReagendar(a) {
    const d = parseLocalDate(a.data_agendamento);
    if (isNaN(d.getTime())) {
      mostrarToast('Data inválida.', 'error');
      return;
    }
    $('#rAgendamentoId').value = a.id;
    $('#rData').value = formatarDataISO(d) || '';
    $('#rHora').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    abrirModal('modalReagendar');
  }

  window.confirmarReagendamento = async function () {
    const id = $('#rAgendamentoId').value;
    const data = $('#rData').value;
    const hora = $('#rHora').value;
    if (!data || !hora) {
      mostrarToast('Informe data e horário.', 'error');
      return;
    }
    try {
      const res = await authFetch(`${API}/agendamentos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data_agendamento: `${data} ${hora}:00` })
      });
      const resposta = await res.json();
      if (resposta.success) {
        mostrarToast('Agendamento reagendado.');
        fecharModal('modalReagendar');
        recarregarGridAtual();
      } else {
        mostrarToast(resposta.message || 'Erro ao reagendar.', 'error');
      }
    } catch (err) { /* authFetch já trata 401 */ }
  };

  // ═══════════════════════════════════════════════════════════════
  // Modal: Novo / Editar agendamento
  // ═══════════════════════════════════════════════════════════════
  function abrirModalAgendamento(opts) {
    const form = $('#formAgendamento');
    if (!form) return;
    form.reset();
    $('#fPacienteId').value = '';
    const sel = $('#fPacienteSelecionado');
    if (sel) sel.style.display = 'none';
    const res = $('#fResultadosPaciente');
    if (res) res.innerHTML = '';

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
      $('#fHora').value = isNaN(d.getTime())
        ? ''
        : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      $('#fTipoTerapia').value = a.tipo_terapia || '';
      $('#fMotivo').value = a.motivo_consulta || '';
      $('#fBuscaPaciente').value = a.nome || '';
      $('#fPacienteId').value = a.paciente_id || '';
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
      const termoNormalizado = termo.trim().toLowerCase();
      const lista = todos.filter(p =>
        (p.nome || '').toLowerCase().includes(termoNormalizado) ||
        (p.telefone || '').replace(/\D/g, '').includes(termoNormalizado.replace(/\D/g, ''))
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
          const sel = $('#fPacienteSelecionado');
          if (sel) {
            sel.style.display = 'block';
            sel.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(item.dataset.nome)} selecionado`;
          }
        });
      });
    } catch (err) {
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
      const hora = $('#fHora').value;
      const tipoTerapia = $('#fTipoTerapia').value;
      const motivo = $('#fMotivo').value;

      if (!pacienteId && !id) {
        mostrarToast('Selecione um paciente na busca.', 'error');
        return;
      }
      if (!data || !hora) {
        mostrarToast('Informe data e horário.', 'error');
        return;
      }

      const payload = {
        data_agendamento: `${data} ${hora}:00`,
        tipo_terapia: tipoTerapia,
        motivo_consulta: motivo
      };

      try {
        let res, resposta;
        if (id) {
          res = await authFetch(`${API}/agendamentos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
        } else {
          payload.paciente_id = pacienteId;
          payload.usuario_id = state.profissional.id;
          res = await authFetch(`${API}/agendamentos`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        resposta = await res.json();
        if (resposta.success) {
          mostrarToast(id ? 'Agendamento atualizado.' : 'Agendamento criado.');
          fecharModal('modalAgendamento');
          recarregarGridAtual();
        } else {
          mostrarToast(resposta.message || 'Erro ao salvar.', 'error');
        }
      } catch (err) { /* authFetch já trata 401 */ }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Modais genéricos
  // ═══════════════════════════════════════════════════════════════
  function abrirModal(id) {
    const el = $(`#${id}`);
    if (el) el.classList.add('open');
  }
  window.fecharModal = function (id) {
    const el = $(`#${id}`);
    if (el) el.classList.remove('open');
  };

  // ═══════════════════════════════════════════════════════════════
  // Rodapé fixo (Quick Switch)
  // ═══════════════════════════════════════════════════════════════
  const btnFooterHoje = $('#btnFooterHoje');
  if (btnFooterHoje) {
    btnFooterHoje.addEventListener('click', async () => {
      if (!state.profissional) {
        mostrarToast('Selecione um profissional primeiro.', 'info');
        return;
      }
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
            const horaStr = isNaN(d.getTime())
              ? '--:--'
              : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="flex items-center justify-between py-3" style="border-bottom:1px solid var(--border)">
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
    } catch (err) { /* authFetch já trata 401 */ }
  }

  const btnFooterCalendarios = $('#btnFooterCalendarios');
  if (btnFooterCalendarios) {
    btnFooterCalendarios.addEventListener('click', () => {
      if (state.profissional) {
        mostrarCamada(2);
        carregarPanoramaAno();
      } else {
        mostrarCamada(1);
      }
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
            if (total > 0) {
              badge.textContent = total > 99 ? '99+' : total;
              badge.classList.remove('hidden');
            } else {
              badge.classList.add('hidden');
            }
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
              <button type="button" class="btn-voltar-camada w-9 h-9 flex items-center justify-center" id="fecharEntrada" aria-label="Fechar" style="flex-shrink:0;">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="px-5 py-3" style="overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">
              ${lista.length ? lista.map(n => `
                <div class="flex items-start gap-3 py-3" style="border-bottom:1px solid var(--border)">
                  <i class="fas fa-bell mt-1" style="color:var(--cyan);flex-shrink:0;"></i>
                  <div style="min-width:0;flex:1;">
                    <p style="color:#e2e8f0;font-weight:700;font-size:13px;word-break:break-word;">${escapeHtml(n.titulo || '')}</p>
                    <p style="color:rgba(148,163,184,0.55);font-size:12px;word-break:break-word;">${escapeHtml(n.mensagem || '')}</p>
                  </div>
                </div>
              `).join('') : `<p style="color:rgba(148,163,184,0.5);font-size:13px;text-align:center;padding:28px 0;">Nenhuma notificação.</p>`}
            </div>
          </div>`;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        function fecharEntrada() {
          overlay.remove();
          document.body.style.overflow = '';
        }
        overlay.querySelector('#fecharEntrada').addEventListener('click', fecharEntrada);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharEntrada(); });
      } catch (err) {
        console.error('Erro ao carregar entrada:', err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Inicialização
  // ═══════════════════════════════════════════════════════════════
  if (!token) {
    mostrarToast('Sessão não encontrada. Faça login novamente.', 'error');
  } else {
    carregarProfissionais();
  }
})();
