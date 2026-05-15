
// ========= 0.1 Agenda ========
function abrirModal(paciente) {
    const modal = document.getElementById('modalPaciente');
    const content = document.getElementById('modalContent');

    // Preenchendo os dados básicos e novos
    document.getElementById('modalNome').textContent = paciente.nome;
    document.getElementById('modalHorario').textContent = paciente.horario;
    document.getElementById('modalStatus').textContent = 'Status: ' + paciente.statusPagamento;

    // Se você quiser mostrar o CPF e Email no Modal também, adicione IDs neles no HTML do modal
    // Exemplo: document.getElementById('modalCPF').textContent = paciente.cpf;

    // Ajustando o link do WhatsApp dentro do Modal também
    const zapLink = `https://wa.me/55${paciente.telefone.replace(/\D/g, '')}`;
    const btnZap = modal.querySelector('.fa-whatsapp').parentElement;
    btnZap.href = zapLink;

    // Mostrar modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// ======== fUNCAO D CALENDARIO -- AGENDA =====
const gridDias = document.getElementById('grid-dias');
const btnSemana = document.getElementById('btn-semana');
const btnMes = document.getElementById('btn-mes');

// DADOS MOCKADOS (Exemplos de agendamentos para o Tooltip)
const dadosAgendamentos = {
    5: { total: 3, horarios: "09:00, 11:00, 15:00" },
    7: { total: 1, horarios: "10:00" },
    8: { total: 5, horarios: "Manhã Cheia" },
    11: { total: 8, horarios: "Dia Inteiro Lotado" }, // Hoje
    12: { total: 2, horarios: "14:00, 16:00" },
    13: { total: 0, horarios: "Livre" }
};

function alternarCalendario(tipo) {
    gridDias.innerHTML = ''; // Limpa a grid

    if (tipo === 'semana') {
        // Estilização dos botões
        btnSemana.className = "px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-white";
        btnMes.className = "px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200";

        // Gera 7 dias (Exemplo: Semana do dia 11)
        const diasSemana = [5, 6, 7, 8, 9, 10, 11]; // Exemplo
        diasSemana.forEach(dia => {
            const isHoje = dia === 11;
            const info = dadosAgendamentos[dia];

            // --- O Poupup (Tooltip) ---
            let popupHtml = '';
            if (info && info.total > 0) {
                popupHtml = `
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50 text-center">
                      <p class="text-[10px] font-black uppercase tracking-wider">${info.total} Agendamentos</p>
                      <p class="text-xs mt-1 font-medium opacity-80">${info.horarios}</p>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-white rotate-45 -translate-y-1.5"></div>
                  </div>
              `;
            }

            gridDias.innerHTML += `
              <div class="group relative h-16 ${isHoje ? 'bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400'} rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all">
                  ${popupHtml}
                  <span class="text-xs font-black">${dia}</span>
                  ${isHoje ? '<span class="text-[8px] uppercase font-bold">Hoje</span>' : ''}
              </div>
          `;
        });
    } else {
        // Estilização dos botões
        btnMes.className = "px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-white";
        btnSemana.className = "px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200";

        // Gera todos os dias (Abril 2026 começa na Quarta)
        for (let i = 1; i <= 33; i++) {
            const diaReal = i - 3;
            if (i <= 3) {
                gridDias.innerHTML += `<div class="h-10 opacity-20 text-xs flex items-center justify-center"></div>`;
            } else if (diaReal <= 30) {
                const isHoje = diaReal === 11;
                const info = dadosAgendamentos[diaReal];

                // --- O Poupup (Tooltip) ---
                let popupHtml = '';
                if (info && info.total > 0) {
                    popupHtml = `
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-32 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50 text-center">
                          <p class="text-[9px] font-black uppercase">${info.total} Pacientes</p>
                          <div class="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45 -translate-y-1"></div>
                      </div>
                  `;
                }

                gridDias.innerHTML += `
                  <div class="group relative h-10 ${isHoje ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'} rounded-xl flex items-center justify-center text-[11px] font-bold cursor-pointer transition-all">
                      ${popupHtml}
                      ${diaReal}
                  </div>
              `;
            }
        }
    }
}

// Inicializa como semana
alternarCalendario('semana');


// ========= 1. FUNCAO Relógio em Tempo Real =========
function atualizarDataHora() {
    const spanData = document.getElementById('data-hora');
    if (!spanData) return;
    const agora = new Date();
    const formatador = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    spanData.textContent = formatador.format(agora);
}
atualizarDataHora();
setInterval(atualizarDataHora, 1000);

// ========= 2. Lógica Principal (Dark Mode e Gráfico) =========
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const html = document.documentElement;
    if (!themeBtn) return;

    const themeText = themeBtn.querySelector('span');
    const themeIcon = themeBtn.querySelector('i');

    // Função de Interface do Botão
    const updateBtnUI = (isDark) => {
        if (isDark) {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeText.textContent = 'Claro';
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeText.textContent = 'Escuro';
        }
    };

    // Carregar tema salvo
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        html.classList.add('dark');
        updateBtnUI(true);
    }

    // --- Configuração do Gráfico ---
    const chartOptions = {
        series: [{ name: 'Atendimentos', data: [12, 19, 15, 25, 10, 8, 5] }],
        chart: {
            type: 'area', height: 300, toolbar: { show: false },
            zoom: { enabled: false }, fontFamily: 'Poppins, sans-serif'
        },
        colors: ['#3b82f6'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 4, colors: ['#10b981'] },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
        grid: { borderColor: html.classList.contains('dark') ? '#1f2937' : '#f1f1f1', strokeDashArray: 4 },
        xaxis: {
            categories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            labels: { style: { colors: '#94a3b8', fontWeight: 600 } }
        },
        yaxis: { show: false },
        tooltip: { theme: html.classList.contains('dark') ? 'dark' : 'light' }
    };

    const chart = new ApexCharts(document.querySelector("#chart-fluxo"), chartOptions);
    chart.render();

    // --- Evento de Clique do Botão de Tema ---
    themeBtn.addEventListener('click', () => {
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        // Atualiza o Botão
        updateBtnUI(isDark);

        // Atualiza o Gráfico para o modo Dark/Light
        chart.updateOptions({
            tooltip: { theme: isDark ? 'dark' : 'light' },
            grid: { borderColor: isDark ? '#1f2937' : '#f1f1f1' }
        });
    });
});
