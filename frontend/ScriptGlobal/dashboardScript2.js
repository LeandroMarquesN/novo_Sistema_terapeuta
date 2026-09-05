// DADOS MOCKADOS (Exemplos de agendamentos para o Tooltip do Calendário)
const dadosAgendamentos = {
    5: { total: 3, horarios: "09:00, 11:00, 15:00" },
    7: { total: 1, horarios: "10:00" },
    8: { total: 5, horarios: "Manhã Cheia" },
    11: { total: 8, horarios: "Dia Inteiro Lotado" },
    12: { total: 2, horarios: "14:00, 16:00" },
    13: { total: 0, horarios: "Livre" }
};

// Array global para guardar as instâncias dos 4 gráficos
let meusGraficosMensais = [];

// ========= 0.1 Agenda (Modal) ========
function abrirModal(paciente) {
    if (!paciente) return;

    const modal = document.getElementById('modalPaciente');
    const content = document.getElementById('modalContent');
    if (!modal) return;

    const txtNome = document.getElementById('modalNome');
    const txtHorario = document.getElementById('modalHorario');
    const txtStatus = document.getElementById('modalStatus');

    if (txtNome) txtNome.textContent = paciente.nome || 'Não informado';
    if (txtHorario) txtHorario.textContent = paciente.horario || '--:--';
    if (txtStatus) txtStatus.textContent = 'Status: ' + (paciente.statusPagamento || 'Pendente');

    const btnZap = document.getElementById('btnModalWhatsapp');
    if (btnZap) {
        if (paciente.telefone) {
            const numeroLimpo = paciente.telefone.replace(/\D/g, '');
            btnZap.href = `https://wa.me/55${numeroLimpo}`;
            btnZap.style.display = 'inline-flex';
        } else {
            btnZap.href = '#';
            btnZap.style.display = 'none';
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        if (content) {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }
    }, 10);
}

// ========= 0.2 Lógica do Calendário Dinâmico =========
function alternarCalendario(tipo) {
    const gridDias = document.getElementById('grid-dias');
    const btnSemana = document.getElementById('btn-semana');
    const btnMes = document.getElementById('btn-mes');
    const txtMesAno = document.getElementById('calendario-mes-ano');

    if (!gridDias || !btnSemana || !btnMes) return;

    const dadosCalendario = window.dadosAgendamentosReais || {};
    const hojeObj = new Date();
    const diaHoje = hojeObj.getDate();
    const mesAtualNome = hojeObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (txtMesAno) {
        txtMesAno.textContent = mesAtualNome.charAt(0).toUpperCase() + mesAtualNome.slice(1);
    }

    gridDias.innerHTML = '';

    if (tipo === 'semana') {
        btnSemana.className = "px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-white";
        btnMes.className = "px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200";

        const diasSemana = [];
        for (let i = -3; i <= 3; i++) {
            const dataPasso = new Date();
            dataPasso.setDate(hojeObj.getDate() + i);
            if (dataPasso.getMonth() === hojeObj.getMonth()) {
                diasSemana.push(dataPasso.getDate());
            }
        }

        diasSemana.forEach(dia => {
            const isHoje = dia === diaHoje;
            const info = dadosCalendario[dia];

            let popupHtml = '';
            if (info && info.total > 0) {
                popupHtml = `
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-44 p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50 text-center">
                      <p class="text-[10px] font-black uppercase tracking-wider text-blue-400 dark:text-blue-600">${info.total} Agendamentos</p>
                      <p class="text-xs mt-1 font-medium opacity-90 truncate">${info.horarios}</p>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-white rotate-45 -translate-y-1.5"></div>
                  </div>`;
            }

            gridDias.innerHTML += `
              <div class="group relative h-16 ${isHoje ? 'bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg font-black' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 font-bold'} rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-md transition-all">
                  ${popupHtml}
                  <span class="text-xs">${dia}</span>
                  ${isHoje ? '<span class="text-[8px] uppercase font-black tracking-wide">Hoje</span>' : ''}
                  ${(!isHoje && info && info.total > 0) ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>` : ''}
              </div>`;
        });
    } else {
        btnMes.className = "px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-white";
        btnSemana.className = "px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200";

        const anoAtual = hojeObj.getFullYear();
        const mesAtual = hojeObj.getMonth();
        const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
        const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

        for (let i = 0; i < primeiroDiaSemana; i++) {
            gridDias.innerHTML += `<div class="h-10 opacity-0"></div>`;
        }

        for (let diaReal = 1; diaReal <= totalDiasMes; diaReal++) {
            const isHoje = diaReal === diaHoje;
            const info = dadosCalendario[diaReal];

            let popupHtml = '';
            if (info && info.total > 0) {
                popupHtml = `
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50 text-center">
                      <p class="text-[9px] font-black uppercase text-blue-400 dark:text-blue-600">${info.total} Pacientes</p>
                      <p class="text-[11px] font-medium opacity-80 truncate">${info.horarios}</p>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45 -translate-y-1"></div>
                  </div>`;
            }

            gridDias.innerHTML += `
              <div class="group relative h-10 ${isHoje ? 'bg-blue-600 text-white font-black shadow-md' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-400 font-bold'} rounded-xl flex flex-col items-center justify-center text-[11px] cursor-pointer transition-all hover:scale-110">
                  ${popupHtml}
                  <span>${diaReal}</span>
                  ${(info && info.total > 0 && !isHoje) ? `<span class="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1"></span>` : ''}
              </div>`;
        }
    }
}

// ========= 0.3 Inicialização Unificada do Painel =========
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const html = document.documentElement;
    const txtUsuario = document.getElementById('usuarioNome');
    const txtClinica = document.getElementById('clinicaNome');
    const txtData = document.getElementById('data-hora');
    const containerData = document.getElementById('data-hora-container-tailwind');

    // Inicializa componentes base
    alternarCalendario('semana');
    inicializarAsideDinamico();
    inicializarTodosGraficos();

    const usuarioLogado = localStorage.getItem('medlm_user_name') || 'Dr. Leandro Marques';
    const clinicaLogada = localStorage.getItem('medlm_clinic_name') || 'Clínica Vida Ativa';

    if (txtUsuario) txtUsuario.textContent = usuarioLogado;
    if (txtClinica) txtClinica.textContent = clinicaLogada;

    function gerenciarRelogio() {
        if (!txtData) return;
        const agora = new Date();
        const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const opcoesData = { weekday: 'long', day: 'numeric', month: 'long' };
        let dataFormatada = agora.toLocaleDateString('pt-BR', opcoesData);
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

        txtData.textContent = `${dataFormatada} • ${horaFormatada}`;
        if (containerData) containerData.classList.remove('hidden');
    }
    gerenciarRelogio();
    setInterval(gerenciarRelogio, 1000);

    // Tema Dark/Light
    if (themeBtn) {
        const themeText = themeBtn.querySelector('span');
        const themeIcon = themeBtn.querySelector('i');

        const updateBtnUI = (isDark) => {
            if (themeIcon) themeIcon.className = isDark ? 'fas fa-sun mr-2' : 'fas fa-moon mr-2';
            if (themeText) themeText.textContent = isDark ? 'Claro' : 'Escuro';
        };

        const currentTheme = localStorage.getItem('theme');
        const isCurrentlyDark = currentTheme === 'dark';
        html.classList.toggle('dark', isCurrentlyDark);
        updateBtnUI(isCurrentlyDark);

        themeBtn.addEventListener('click', () => {
            html.classList.toggle('dark');
            const isDark = html.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateBtnUI(isDark);

            meusGraficosMensais.forEach(chartInstance => {
                if (chartInstance) {
                    chartInstance.updateOptions({
                        tooltip: { theme: isDark ? 'dark' : 'light' },
                        grid: { borderColor: isDark ? '#1f2937' : '#f3f4f6' },
                        xaxis: { labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } } },
                        yaxis: { labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } } }
                    });
                }
            });
        });
    }
});

// ========= 0.4 Card Lateral Dinâmico =========
let indicePacienteAtual = 0;

function inicializarAsideDinamico() {
    const lista = window.listaAgendamentosReais || [];
    if (lista.length === 0) {
        const txtNome = document.getElementById('infoNomeAside');
        if (txtNome) txtNome.textContent = "Nenhum paciente hoje";
        const contador = document.getElementById('infoContadorAside');
        if (contador) contador.textContent = "Sem agendamentos";
        return;
    }
    atualizarCardAside(indicePacienteAtual);
}

function atualizarCardAside(index) {
    const lista = window.listaAgendamentosReais || [];
    if (lista.length === 0 || index < 0 || index >= lista.length) return;

    const paciente = lista[index];

    const txtNome = document.getElementById('infoNomeAside');
    const txtTerapia = document.getElementById('infoTerapiaAside');
    const txtStatus = document.getElementById('infoStatusAside');
    const iconStatus = document.getElementById('infoStatusIconAside');
    const txtTelefone = document.getElementById('infoTelefoneAside');
    const txtIniciais = document.getElementById('infoIniciaisAside');
    const txtContador = document.getElementById('infoContadorAside');
    const btnProntuario = document.getElementById('btnLinkProntuario');
    const cardAside = document.getElementById('asidePaciente');

    if (txtIniciais && paciente.nome) {
        const partes = paciente.nome.trim().split(' ');
        const iniciais = partes.length > 1
            ? (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase()
            : partes[0].slice(0, 2).toUpperCase();
        txtIniciais.textContent = iniciais;
    }

    if (txtNome) txtNome.textContent = paciente.nome;
    if (txtTerapia) txtTerapia.textContent = paciente.tipo_terapia || 'Não informada';
    if (txtTelefone) txtTelefone.textContent = paciente.telefone || '(00) 00000-0000';
    if (txtContador) txtContador.textContent = `${index + 1} de ${lista.length} Pacientes`;

    if (btnProntuario) btnProntuario.href = `/agendamento/editar/${paciente.id}`;

    if (txtStatus) txtStatus.textContent = paciente.status_agendamento;
    if (iconStatus) {
        if (paciente.status_agendamento === 'confirmado') {
            iconStatus.className = "fas fa-check-circle text-emerald-300 text-xl";
        } else if (paciente.status_agendamento === 'pendente') {
            iconStatus.className = "fas fa-clock text-amber-300 text-xl animate-pulse";
        } else {
            iconStatus.className = "fas fa-times-circle text-red-300 text-xl";
        }
    }

    if (cardAside) {
        cardAside.classList.add('opacity-80', 'scale-[0.99]');
        setTimeout(() => {
            cardAside.classList.remove('opacity-80', 'scale-[0.99]');
        }, 150);
    }
}

function navegarPaciente(direcao) {
    const lista = window.listaAgendamentosReais || [];
    if (lista.length === 0) return;

    if (direcao === 'proximo') {
        indicePacienteAtual = (indicePacienteAtual + 1) % lista.length;
    } else if (direcao === 'anterior') {
        indicePacienteAtual = (indicePacienteAtual - 1 + lista.length) % lista.length;
    }
    atualizarCardAside(indicePacienteAtual);
}

// ========= 0.5 Gráficos =========
function inicializarTodosGraficos() {
    if (typeof ApexCharts === 'undefined') {
        setTimeout(inicializarTodosGraficos, 100);
        return;
    }

    meusGraficosMensais = [];

    const dadosReais = window.dadosComparativoMensal || {
        semana1: [0, 0, 0, 0, 0, 0, 0],
        semana2: [0, 0, 0, 0, 0, 0, 0],
        semana3: [0, 0, 0, 0, 0, 0, 0],
        semana4: [0, 0, 0, 0, 0, 0, 0]
    };

    const labelsDias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    criarGraficoSemanal('chart-semana-1', 'Semana 1', dadosReais.semana1, labelsDias);
    criarGraficoSemanal('chart-semana-2', 'Semana 2', dadosReais.semana2, labelsDias);
    criarGraficoSemanal('chart-semana-3', 'Semana 3', dadosReais.semana3, labelsDias);
    criarGraficoSemanal('chart-semana-4', 'Semana 4', dadosReais.semana4, labelsDias);
}

function criarGraficoSemanal(idContainer, nomeSerie, valores, labels) {
    const container = document.getElementById(idContainer);
    if (!container) return;

    container.innerHTML = '';
    const isDarkMode = document.documentElement.classList.contains('dark');

    const options = {
        chart: {
            type: 'area',
            height: 280,
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'Inter, sans-serif',
            animations: { enabled: true, speed: 600 }
        },
        series: [{ name: nomeSerie, data: valores }],
        xaxis: {
            categories: labels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '11px', fontWeight: 600 } }
        },
        yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: { style: { colors: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '11px' } }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3.5, colors: ['#3b82f6'] },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.01,
                stops: [0, 90, 100],
                colorStops: [
                    { offset: 0, color: "#3b82f6", opacity: 0.4 },
                    { offset: 60, color: "#10b981", opacity: 0.1 },
                    { offset: 100, color: "#3b82f6", opacity: 0.0 }
                ]
            }
        },
        grid: {
            borderColor: isDarkMode ? '#1f2937' : '#f3f4f6',
            strokeDashArray: 4
        },
        tooltip: {
            enabled: true,
            shared: false,
            intersect: false,
            theme: isDarkMode ? 'dark' : 'light',
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const valor = series[seriesIndex][dataPointIndex];
                const dia = w.globals.labels[dataPointIndex];
                const textoAtendimento = valor === 1 ? 'atendimento' : 'atendimentos';

                return `
                    <div class="bg-gray-950 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-2xl shadow-2xl border border-gray-800 dark:border-gray-100 text-left min-w-[140px]">
                        <p class="text-[9px] uppercase font-black tracking-wider text-gray-400 dark:text-gray-500">${dia}-Feira</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <p class="text-xs font-extrabold leading-none">
                                ${valor} <span class="text-[10px] font-medium text-gray-300 dark:text-gray-600">${textoAtendimento}</span>
                            </p>
                        </div>
                    </div>`;
            }
        },
        markers: {
            size: 0,
            colors: ['#3b82f6'],
            strokeColors: '#fff',
            hover: { size: 5 }
        },
        colors: ['#3b82f6']
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    meusGraficosMensais.push(chart);
}

// ========= 0.6 FILTRAGEM DE PACIENTES (DESKTOP + MOBILE) =========

/**
 * Renderiza os cards mobile com a mesma estrutura do EJS
 */
function renderizarCardsMobile(agendamentos) {
    const container = document.getElementById('mobile-pacientes-cards');
    if (!container) return;

    container.innerHTML = '';

    if (!agendamentos || agendamentos.length === 0) {
        container.innerHTML = `
            <div class="empty-state-mobile">
                <div class="empty-icon-wrap">
                    <i class="fas fa-calendar-times"></i>
                </div>
                <p class="font-semibold text-slate-200">Nenhum atendimento cadastrado</p>
                <p class="text-sm mt-1 text-slate-500">Sua agenda está livre para este período.</p>
            </div>`;
        return;
    }

    agendamentos.forEach(agendamento => {
        let badgeClassM = 'status-default';
        if (agendamento.status_agendamento === 'confirmado') badgeClassM = 'status-confirmado';
        else if (agendamento.status_agendamento === 'pendente') badgeClassM = 'status-pendente';
        else if (agendamento.status_agendamento === 'cancelado') badgeClassM = 'status-cancelado';

        const dataLinha = new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR');
        const horaLinha = new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const cardHtml = `
            <div class="patient-card-mobile">
                <div class="card-top">
                    <div>
                        <div class="patient-id">#${agendamento.id}</div>
                        <div class="patient-name">${agendamento.nome || 'Paciente'}</div>
                        <div class="patient-phone">
                            <i class="fab fa-whatsapp"></i> ${agendamento.telefone || 'Sem telefone'}
                        </div>
                    </div>
                    <span class="status-badge ${badgeClassM}">
                        <span class="status-dot"></span>
                        ${agendamento.status_agendamento}
                    </span>
                </div>

                <div class="card-meta">
                    <span class="meta-item">
                        <i class="far fa-calendar"></i>
                        ${dataLinha}
                    </span>
                    <span class="meta-item">
                        <i class="far fa-clock"></i>
                        ${horaLinha} hs
                    </span>
                    <span class="therapy-badge">${agendamento.tipo_terapia || '—'}</span>
                </div>

                <div class="card-actions">
                    <button onclick="abrirGavetaProntuario('${agendamento.id}')" class="btn-prontuario">
                        <i class="fas fa-folder-open"></i> Ver Prontuário
                    </button>
                </div>
            </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

/**
 * Filtra tabela desktop + cards mobile
 */
async function filtrarTabelaTerapeutica(tipoFiltro) {
    try {
        const response = await fetch(`/dashboard?filtro=${tipoFiltro}`, {
            headers: { 'Accept': 'application/json' }
        });
        const dados = await response.json();

        // Atualiza estilo dos botões de filtro
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            if (btn.getAttribute('data-filtro') === tipoFiltro) {
                btn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-white');
                btn.classList.remove('text-gray-400', 'hover:text-gray-600', 'dark:hover:text-gray-300');
            } else {
                btn.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-white');
                btn.classList.add('text-gray-400', 'hover:text-gray-600', 'dark:hover:text-gray-300');
            }
        });

        const tbody = document.getElementById('tabela-pacientes-body');
        if (tbody) tbody.innerHTML = '';

        // Estado vazio
        if (!dados.agendamentos || dados.agendamentos.length === 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-12 text-center">
                            <div class="flex flex-col items-center justify-center">
                                <div class="empty-icon-wrap mb-2 text-slate-500">
                                    <i class="fas fa-calendar-times text-lg"></i>
                                </div>
                                <p class="font-semibold text-sm text-slate-200">Nenhum atendimento cadastrado</p>
                                <p class="text-xs mt-0.5 text-slate-500">Sua agenda está livre para este período.</p>
                            </div>
                        </td>
                    </tr>`;
            }
            renderizarCardsMobile([]);
            return;
        }

        // Monta linhas da tabela desktop
        dados.agendamentos.forEach(agendamento => {
            let badgeClass = 'status-default';
            if (agendamento.status_agendamento === 'confirmado') badgeClass = 'status-confirmado';
            else if (agendamento.status_agendamento === 'pendente') badgeClass = 'status-pendente';
            else if (agendamento.status_agendamento === 'cancelado') badgeClass = 'status-cancelado';

            const dataLinha = new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR');
            const horaLinha = new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const linhaHtml = `
                <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors">
                    <td class="px-4 py-4 text-xs font-semibold whitespace-nowrap" style="color:rgba(52,211,153,0.4)">#${agendamento.id}</td>
                    <td class="px-4 py-4">
                        <div class="patient-name font-bold text-white text-xs truncate max-w-[180px]" title="${agendamento.nome || ''}">${agendamento.nome || 'Paciente'}</div>
                        <div class="patient-phone mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                            <i class="fab fa-whatsapp text-teal-400"></i> ${agendamento.telefone || ''}
                        </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                        <div class="date-val text-xs text-slate-200">${dataLinha}</div>
                        <div class="time-badge mt-1 inline-flex items-center gap-1 text-[11px] text-teal-300 bg-teal-950/40 px-2 py-0.5 rounded-md">
                            <i class="far fa-clock text-[9px]"></i>
                            ${horaLinha} hs
                        </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                        <span class="therapy-badge text-xs text-slate-300">${agendamento.tipo_terapia || '—'}</span>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                        <span class="status-badge ${badgeClass} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            <span class="status-dot w-1.5 h-1.5 rounded-full bg-current"></span>
                            ${agendamento.status_agendamento}
                        </span>
                    </td>
                    <td class="px-4 py-4 text-right whitespace-nowrap">
                        <button onclick="abrirGavetaProntuario('${agendamento.id}')" class="btn-prontuario text-xs bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-800/50 px-3 py-1.5 rounded-xl transition-all font-bold">
                            Ver Prontuário
                        </button>
                    </td>
                </tr>`;

            if (tbody) tbody.insertAdjacentHTML('beforeend', linhaHtml);
        });

        // Atualiza também os cards mobile
        renderizarCardsMobile(dados.agendamentos);

    } catch (error) {
        console.error("Erro ao aplicar filtro assíncrono:", error);
    }
}

// ========= 0.7 Gaveta de Prontuário =========
async function abrirGavetaProntuario(agendamentoId) {
    const gaveta = document.getElementById('gaveta-prontuario');
    const backdrop = document.getElementById('gaveta-backdrop');
    const painel = document.getElementById('gaveta-painel');

    document.getElementById('gaveta-paciente-nome').innerText = "Carregando dados...";
    gaveta.classList.remove('invisible');

    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        backdrop.classList.add('opacity-100');
        painel.classList.remove('-translate-x-full');
        painel.classList.add('translate-x-0');
    }, 10);

    try {
        const response = await fetch(`/api/agendamentos/detalhes/${agendamentoId}`);
        const dados = await response.json();

        if (!response.ok) throw new Error(dados.erro || "Erro ao buscar prontuário.");

        document.getElementById('gaveta-paciente-nome').innerText = dados.nome;
        document.getElementById('gaveta-paciente-data').innerText = `${dados.data_formatada} às ${dados.hora_formatada}`;
        document.getElementById('gaveta-paciente-terapia').innerText = dados.tipo_terapia;
        document.getElementById('gaveta-paciente-whats').innerText = dados.telefone || 'Não informado';
        document.getElementById('gaveta-paciente-cpf').innerText = dados.cpf;

        document.getElementById('gaveta-paciente-idade').innerText = dados.idade ? `${dados.idade} anos` : '-';
        document.getElementById('gaveta-paciente-peso').innerText = dados.peso ? `${dados.peso} kg` : '-';
        document.getElementById('gaveta-paciente-altura').innerText = dados.altura ? `${dados.altura} m` : '-';

        document.getElementById('gaveta-paciente-motivo').innerText = dados.motivo_consulta || 'Nenhuma queixa registrada.';
        document.getElementById('gaveta-paciente-condicoes').innerText = dados.condicoes || 'Nenhuma condição registrada.';
        document.getElementById('gaveta-paciente-obs').value = dados.observacoes || '';

    } catch (err) {
        console.error(err);
        document.getElementById('gaveta-paciente-nome').innerText = "Erro ao carregar dados";
        alert("Não foi possível buscar as informações atualizadas do banco de dados.");
        fecharGavetaProntuario();
    }
}

function fecharGavetaProntuario() {
    const gaveta = document.getElementById('gaveta-prontuario');
    const backdrop = document.getElementById('gaveta-backdrop');
    const painel = document.getElementById('gaveta-painel');

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    painel.classList.remove('translate-x-0');
    painel.classList.add('-translate-x-full');

    setTimeout(() => {
        gaveta.classList.add('invisible');
    }, 300);
}

// ========= 0.8 Estatísticas do Dashboard =========
async function carregarEstatisticasDashboard() {
    try {
        const response = await fetch('/api/dashboard/estatisticas-hoje', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Erro ao buscar estatísticas');

        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Erro desconhecido');

        document.getElementById('statAtendimentos').innerText = data.atendimentos.total;

        const variacao = data.atendimentos.variacao_percentual;
        const variacaoDiv = document.getElementById('statAtendimentosVariacao');
        const variacaoIcon = variacaoDiv.querySelector('i');
        const variacaoTexto = document.getElementById('statAtendimentosVariacaoTexto');

        if (variacao >= 0) {
            variacaoIcon.className = 'fas fa-arrow-up';
            variacaoDiv.style.color = 'var(--emerald)';
            variacaoTexto.innerText = `+${variacao}%`;
        } else {
            variacaoIcon.className = 'fas fa-arrow-down';
            variacaoDiv.style.color = '#f87171';
            variacaoTexto.innerText = `${variacao}%`;
        }

        document.getElementById('statCancelamentos').innerText = data.cancelamentos.total;
        document.getElementById('statCancelamentosTaxa').innerText = data.cancelamentos.taxa_percentual.toFixed(1);

        document.getElementById('statFaturamento').innerText = `R$ ${data.faturamento.total.toFixed(2).replace('.', ',')}`;
        document.getElementById('statFaturamentoSessoes').innerText = data.faturamento.sessoes_liquidadas;

        document.getElementById('statProximaSemana').innerText = data.proxima_semana.total;

    } catch (error) {
        console.error('Erro ao carregar estatísticas do dashboard:', error);
        ['statAtendimentos', 'statCancelamentos', 'statFaturamento', 'statProximaSemana'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = '—';
        });
    }
}

// ========= 0.9 Painel de Agendamentos (Kanban) =========

/**
 * Verifica se a DATA (ignorando o horário) de um agendamento já passou.
 * Agendamentos de hoje continuam visíveis mesmo que o horário já tenha passado;
 * só somem da tela os de dias anteriores a hoje.
 */
function dataAgendamentoJaPassou(dataAgendamentoStr) {
    if (!dataAgendamentoStr) return false;

    const dataAg = new Date(dataAgendamentoStr);
    if (isNaN(dataAg.getTime())) return false;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataAgSoData = new Date(dataAg.getFullYear(), dataAg.getMonth(), dataAg.getDate());

    return dataAgSoData.getTime() < hoje.getTime();
}

/**
 * Retorna a classe de cor de contraste (mesma paleta usada no resto da página)
 * de acordo com o status do agendamento.
 */
function classeCorKanban(status) {
    if (status === 'confirmado') return 'kanban-card-confirmado';
    if (status === 'aguardando_sinal') return 'kanban-card-aguardando';
    if (status === 'finalizado') return 'kanban-card-finalizado';
    return 'kanban-card-outros'; // cancelado, nao_compareceu, etc.
}

const HTML_AVISO_VENCIDO = `
    <div class="kanban-aviso-vencido">
        <i class="fas fa-calendar-check"></i>
        <span>Os agendamentos desta categoria já passaram da data e foram ocultados. Só ficam visíveis os de hoje e datas futuras.</span>
    </div>`;

const HTML_SEM_AGENDAMENTOS = `
    <p class="text-xs text-slate-500 font-medium p-2">Nenhum agendamento nesta categoria.</p>`;

async function carregarPainelAgendamentosCard() {
    try {
        const response = await fetch('/dashboard?filtro=todos', {
            headers: { 'Accept': 'application/json' }
        });
        const dados = await response.json();

        const colunas = {
            'confirmado': document.getElementById('coluna-confirmados'),
            'aguardando_sinal': document.getElementById('coluna-aguardando'),
            'finalizado': document.getElementById('coluna-finalizados'),
            'cancelado': document.getElementById('coluna-outros'),
            'nao_compareceu': document.getElementById('coluna-outros')
        };

        Object.values(colunas).forEach(col => {
            if (col) col.innerHTML = '';
        });

        // Controla, por elemento de coluna (não por status — 'cancelado' e
        // 'nao_compareceu' compartilham a mesma coluna "Outros"), se ela
        // recebeu algum item (mesmo que vencido) e se recebeu algum item
        // VISÍVEL (hoje ou datas futuras). Usamos um Map com o próprio
        // elemento DOM como chave para evitar contagem duplicada.
        const colunaTeveItem = new Map();
        const colunaTeveItemVisivel = new Map();
        Object.values(colunas).forEach(col => {
            if (!col) return;
            if (!colunaTeveItem.has(col)) colunaTeveItem.set(col, false);
            if (!colunaTeveItemVisivel.has(col)) colunaTeveItemVisivel.set(col, false);
        });

        if (!dados.agendamentos || dados.agendamentos.length === 0) {
            Object.values(colunas).forEach(col => {
                if (col) col.innerHTML = HTML_SEM_AGENDAMENTOS;
            });
            return;
        }

        dados.agendamentos.forEach(item => {
            const statusChave = colunas[item.status_agendamento] ? item.status_agendamento : 'cancelado';
            const targetColuna = colunas[statusChave];
            if (!targetColuna) return;

            colunaTeveItem.set(targetColuna, true);

            // Agendamentos com data já passada somem da tela; só ficam
            // visíveis os de hoje em diante.
            if (dataAgendamentoJaPassou(item.data_agendamento)) {
                return;
            }

            colunaTeveItemVisivel.set(targetColuna, true);

            let badgeStyle = 'bg-slate-800 text-slate-300 border border-slate-700';
            if (item.status_agendamento === 'confirmado') {
                badgeStyle = 'bg-teal-950/60 text-teal-300 border border-teal-800/50';
            } else if (item.status_agendamento === 'aguardando_sinal') {
                badgeStyle = 'bg-amber-950/60 text-amber-300 border border-amber-800/50';
            } else if (item.status_agendamento === 'finalizado') {
                badgeStyle = 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50';
            }

            const dataFormatada = item.data_agendamento ? new Date(item.data_agendamento).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : 'Hora não definida';

            const classeCor = classeCorKanban(item.status_agendamento);

            const cardHTML = `
                <div class="kanban-card ${classeCor} bg-[#121c24] p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between gap-3">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-sm text-white truncate max-w-[110px]" title="${item.nome || ''}">${item.nome || 'Paciente'}</h4>
                            <span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${badgeStyle}">${item.status_agendamento.replace('_', ' ')}</span>
                        </div>
                        <p class="text-xs text-slate-400 mb-1">Terapia: <span class="font-medium text-slate-200">${item.tipo_terapia || 'Geral'}</span></p>
                        <p class="text-xs text-slate-500">Horário: <span class="font-medium text-slate-300">${dataFormatada}</span></p>
                    </div>
                    <div class="flex justify-between items-center pt-2.5 border-t border-slate-800/60 text-xs">
                        <span class="text-slate-400 font-medium">${item.telefone || 'Sem tel'}</span>
                        <button class="text-teal-400 hover:text-teal-300 font-bold transition-colors">Detalhes</button>
                    </div>
                </div>`;
            targetColuna.innerHTML += cardHTML;
        });

        // Preenche o recado nas colunas (elementos únicos) que ficaram vazias na tela.
        const colunasUnicas = new Set(Object.values(colunas).filter(Boolean));
        colunasUnicas.forEach(col => {
            if (colunaTeveItemVisivel.get(col)) return; // já tem cards visíveis, não mexe

            if (colunaTeveItem.get(col)) {
                // Tinha agendamento(s), mas todos venceram e foram ocultados.
                col.innerHTML = HTML_AVISO_VENCIDO;
            } else if (col.innerHTML.trim() === '') {
                // Nunca teve nenhum agendamento nesta categoria.
                col.innerHTML = HTML_SEM_AGENDAMENTOS;
            }
        });

    } catch (error) {
        console.error('Erro ao renderizar painel de agendamentos:', error);
    }
}

// ========= Inicialização final =========
document.addEventListener('DOMContentLoaded', () => {
    carregarEstatisticasDashboard();
    carregarPainelAgendamentosCard();
});

// Atualização automática a cada 2 minutos
setInterval(() => {
    carregarEstatisticasDashboard();
    carregarPainelAgendamentosCard();
}, 2 * 60 * 1000);

// Fecha a gaveta ao clicar no backdrop
const backdrop = document.getElementById('gaveta-backdrop');
if (backdrop) {
    backdrop.addEventListener('click', fecharGavetaProntuario);
}