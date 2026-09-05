const dataHelper = require('../utils/dataHelper');

exports.gerarSlotsDisponiveis = (config, agendamentosOcupados, dataConsulta) => {
    // dataConsulta deve ser uma string 'YYYY-MM-DD'

    // ─── 1. Verifica se o dia da semana está habilitado ───
    const diasPermitidos = (config.dias_semana || '1,2,3,4,5')
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

    const diaSemanaConsulta = new Date(dataConsulta + 'T12:00:00').getDay().toString();
    // getDay(): 0=Dom, 1=Seg, ... 6=Sáb — mesmo padrão usado no HTML

    if (!diasPermitidos.includes(diaSemanaConsulta)) {
        console.log(`[AgendaService] ${dataConsulta} não é dia de atendimento.`);
        return [];
    }

    // ─── 2. Verifica se a data cai dentro de algum recesso/feriado ───
    let periodosFechados = [];
    try {
        periodosFechados = typeof config.periodos_fechados === 'string'
            ? JSON.parse(config.periodos_fechados || '[]')
            : (config.periodos_fechados || []);
    } catch (e) {
        console.error('[AgendaService] periodos_fechados inválido:', e.message);
        periodosFechados = [];
    }

    const dataAlvo = new Date(dataConsulta + 'T00:00:00');
    const estaEmRecesso = periodosFechados.some(periodo => {
        const inicio = new Date(periodo.inicio + 'T00:00:00');
        const fim = new Date(periodo.fim + 'T00:00:00');
        return dataAlvo >= inicio && dataAlvo <= fim;
    });

    if (estaEmRecesso) {
        console.log(`[AgendaService] ${dataConsulta} está dentro de um período de recesso.`);
        return [];
    }

    // ─── 3. Intervalos de pausa diários (almoço, reunião, etc.) ───
    let intervalosPausa = [];
    try {
        intervalosPausa = typeof config.intervalos_pausa === 'string'
            ? JSON.parse(config.intervalos_pausa || '[]')
            : (config.intervalos_pausa || []);
        if (!Array.isArray(intervalosPausa)) intervalosPausa = [];
    } catch (e) {
        console.error('[AgendaService] intervalos_pausa inválido:', e.message);
        intervalosPausa = [];
    }

    const paraMinutos = (time) => {
        if (!time) return 0;
        const [h, m] = String(time).substring(0, 5).split(':').map(Number);
        return h * 60 + m;
    };

    const slotCaiEmPausa = (inicioMin, fimMin) => {
        return intervalosPausa.some(p => {
            const iniP = paraMinutos(p.inicio);
            const fimP = paraMinutos(p.fim);
            // sobreposição: [inicioMin, fimMin) com [iniP, fimP)
            return inicioMin < fimP && fimMin > iniP;
        });
    };

    // ─── 4. Geração de slots ───
    const slots = [];

    const aberturaMin = paraMinutos(config.horario_abertura);
    const fechamentoMin = paraMinutos(config.horario_fechamento);
    const duracao = parseInt(config.duracao_atendimento) || 60;

    const minutosOcupados = agendamentosOcupados.map(ag => {
        const d = new Date(ag.data_agendamento);
        const formatter = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
        });
        const partes = formatter.formatToParts(d);
        const h = parseInt(partes.find(p => p.type === 'hour').value);
        const m = parseInt(partes.find(p => p.type === 'minute').value);
        return h * 60 + m;
    });

    console.log("[AgendaService] Minutos ocupados:", minutosOcupados);
    if (intervalosPausa.length) {
        console.log("[AgendaService] Pausas diárias:", intervalosPausa.map(p => `${p.inicio}-${p.fim}`).join(', '));
    }

    // Só gera slot se o atendimento inteiro cabe antes do fechamento
    for (let m = aberturaMin; m + duracao <= fechamentoMin; m += duracao) {
        // Já tem consulta neste horário?
        if (minutosOcupados.includes(m)) continue;

        // Cai em pausa (ex.: almoço)?
        if (slotCaiEmPausa(m, m + duracao)) continue;

        const horaFormatada = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        slots.push(horaFormatada);
    }

    return slots;
};
