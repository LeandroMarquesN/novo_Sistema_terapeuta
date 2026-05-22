// DADOS MOCKADOS (Exemplos de agendamentos para o Tooltip do Calendário)
const dadosAgendamentos = {
    5: { total: 3, horarios: "09:00, 11:00, 15:00" },
    7: { total: 1, horarios: "10:00" },
    8: { total: 5, horarios: "Manhã Cheia" },
    11: { total: 8, horarios: "Dia Inteiro Lotado" },
    12: { total: 2, horarios: "14:00, 16:00" },
    13: { total: 0, horarios: "Livre" }
};

// Array global para guardar as instâncias dos 4 gráficos e podermos atualizar no Dark Mode
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

// ========= 0.2 Lógica do Calendário Dinâmico (Agenda) =====
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
                  </div>
              `;
            }

            gridDias.innerHTML += `
              <div class="group relative h-16 ${isHoje ? 'bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg font-black' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 font-bold'} rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-md transition-all">
                  ${popupHtml}
                  <span class="text-xs">${dia}</span>
                  ${isHoje ? '<span class="text-[8px] uppercase font-black tracking-wide">Hoje</span>' : ''}
                  ${(!isHoje && info && info.total > 0) ? `<span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>` : ''}
              </div>
          `;
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
                  </div>
              `;
            }

            gridDias.innerHTML += `
              <div class="group relative h-10 ${isHoje ? 'bg-blue-600 text-white font-black shadow-md' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-400 font-bold'} rounded-xl flex flex-col items-center justify-center text-[11px] cursor-pointer transition-all hover:scale-110">
                  ${popupHtml}
                  <span>${diaReal}</span>
                  ${(info && info.total > 0 && !isHoje) ? `<span class="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1"></span>` : ''}
              </div>
          `;
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

    // Inicializa os componentes base
    alternarCalendario('semana');
    inicializarAsideDinamico();
    inicializarTodosGraficos(); // 🚀 CORRIGIDO: Agora chama a função correta que cria os 4 gráficos

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

    // Gerenciamento Inteligente de Tema (Dark/Light)
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

            // 🚀 CORRIGIDO: Faz o loop correto para atualizar as cores nos 4 gráficos simultaneamente
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

// ========= 0.4 Controle do Card Lateral Dinâmico (Navegação) =========
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

// ========= 0.5 Renderização dos Gráficos por Semana do Mês =========
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
                    </div>
                `;
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