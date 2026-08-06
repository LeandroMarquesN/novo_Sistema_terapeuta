document.getElementById('btnFalarAgenda').addEventListener('click', async () => {
    const btn = document.getElementById('btnFalarAgenda');

    // Evita cliques enquanto está falando
    if (btn.classList.contains('falando') || btn.disabled) {
        // Se já estiver falando, cancela
        window.speechSynthesis.cancel();
        resetarBotao(btn);
        return;
    }

    try {
        console.log("[VoiceSystem] Iniciando busca pela agenda do dia...");
        btn.disabled = true;
        btn.innerText = "Carregando...";

        const response = await fetch('/api/agendamentos/hoje');
        if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);

        const agendaCrua = await response.json();
        console.log("[VoiceSystem] Dados brutos recebidos da API:", agendaCrua);

        // Filtra cancelados
        const agenda = agendaCrua.filter(item => item.status_agendamento !== 'cancelado');

        // ========== MONTAGEM DO TEXTO ==========
        let texto = "";

        if (agenda && agenda.length > 0) {
            const total = agenda.length;

            texto = total === 1
                ? `Olá! Você tem 1 agendamento ativo para hoje. `
                : `Olá! Você tem ${total} agendamentos ativos para hoje. `;

            texto += "A sua sequência de atendimentos é a seguinte: ";

            agenda.forEach((item, index) => {
                let horarioFalar = "";
                const dataEHora = item.data_agendamento || item.horario;

                if (dataEHora && dataEHora.includes(' ')) {
                    const horaCompleta = dataEHora.split(' ')[1];
                    const partes = horaCompleta.split(':');
                    const hora = parseInt(partes[0], 10);
                    const minute = parseInt(partes[1], 10);

                    horarioFalar = `${hora} hora${hora > 1 ? 's' : ''}`;
                    if (minute > 0) horarioFalar += ` e ${minute} minuto${minute > 1 ? 's' : ''}`;
                } else if (dataEHora) {
                    const partes = dataEHora.split(':');
                    const hora = parseInt(partes[0], 10);
                    const minute = parseInt(partes[1], 10);

                    horarioFalar = `${hora} hora${hora > 1 ? 's' : ''}`;
                    if (minute > 0) horarioFalar += ` e ${minute} minuto${minute > 1 ? 's' : ''}`;
                } else {
                    horarioFalar = "horário não informado";
                }

                const nomePaciente = item.paciente_nome || item.nome || "Paciente não identificado";

                let statusTexto = "";
                switch (item.status_agendamento) {
                    case 'aguardando_sinal':
                        statusTexto = ", ainda aguardando o sinal de pagamento";
                        break;
                    case 'confirmado':
                        statusTexto = ", já confirmado";
                        break;
                    case 'finalizado':
                        statusTexto = ", atendimento já finalizado";
                        break;
                    default:
                        statusTexto = "";
                }

                texto += `Às ${horarioFalar}, paciente ${nomePaciente}${statusTexto}. `;

                if (index < total - 1) {
                    texto += "Próximo atendimento: ";
                }
            });

            texto += " Tenha um excelente dia de atendimentos!";
        } else {
            texto = "Olá! Você não possui agendamentos ativos marcados para o dia de hoje. Aproveite o seu tempo livre!";
        }

        console.log("[VoiceSystem] Texto completo:", texto);

        // ========== FALA COM DIVISÃO EM PARTES ==========
        await falarTextoEmPartes(texto, btn);

    } catch (error) {
        console.error("[VoiceSystem] ERRO CRÍTICO:", error);
        alert("Não foi possível processar a leitura da agenda.");
        resetarBotao(btn);
    }
});

/**
 * Divide o texto em partes menores e fala em sequência
 * Mais estável em iOS e Android
 */
function falarTextoEmPartes(textoCompleto, btn) {
    return new Promise((resolve) => {
        window.speechSynthesis.cancel();

        // 1. Divide o texto em frases (melhor que cortar no meio da palavra)
        const partes = dividirTextoEmPartes(textoCompleto, 200); // ~200 caracteres por parte
        console.log(`[VoiceSystem] Texto dividido em ${partes.length} partes`);

        let indiceAtual = 0;

        const falarProximaParte = () => {
            if (indiceAtual >= partes.length) {
                // Terminou todas as partes
                console.log("[VoiceSystem] Todas as partes foram faladas");
                resetarBotao(btn);
                resolve();
                return;
            }

            const parte = partes[indiceAtual];
            console.log(`[VoiceSystem] Falando parte ${indiceAtual + 1}/${partes.length}:`, parte);

            const utterance = new SpeechSynthesisUtterance(parte);
            utterance.lang = 'pt-BR';
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Tenta aplicar voz em português
            const vozes = window.speechSynthesis.getVoices();
            const vozPT = vozes.find(v => v.lang === 'pt-BR' || v.lang.startsWith('pt'));
            if (vozPT) utterance.voice = vozPT;

            utterance.onend = () => {
                indiceAtual++;
                // Pequena pausa entre as partes (fica mais natural)
                setTimeout(falarProximaParte, 280);
            };

            utterance.onerror = (e) => {
                console.error("[VoiceSystem] Erro na parte:", e.error);
                indiceAtual++;
                setTimeout(falarProximaParte, 200);
            };

            window.speechSynthesis.speak(utterance);

            // Truque para alguns mobiles
            setTimeout(() => {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
            }, 80);
        };

        // Atualiza o botão
        btn.classList.add('falando');
        btn.innerText = "🔊 Ouvindo Agenda...";
        btn.disabled = true;

        // Começa a falar a primeira parte
        falarProximaParte();

        // Timeout de segurança geral
        const tempoEstimado = Math.max(12000, textoCompleto.length * 75);
        setTimeout(() => {
            if (btn.classList.contains('falando')) {
                console.warn("[VoiceSystem] Timeout de segurança ativado");
                window.speechSynthesis.cancel();
                resetarBotao(btn);
                resolve();
            }
        }, tempoEstimado + 4000);
    });
}

/**
 * Divide o texto de forma inteligente (tenta quebrar em frases)
 */
function dividirTextoEmPartes(texto, tamanhoMaximo = 200) {
    // Primeiro tenta dividir por pontuação
    const frases = texto.match(/[^.!?]+[.!?]+[\s]*/g) || [texto];

    const partes = [];
    let atual = "";

    frases.forEach(frase => {
        if ((atual + frase).length <= tamanhoMaximo) {
            atual += frase;
        } else {
            if (atual) partes.push(atual.trim());
            atual = frase;
        }
    });

    if (atual) partes.push(atual.trim());

    // Se ainda ficou alguma parte muito grande, força a divisão
    const resultadoFinal = [];
    partes.forEach(parte => {
        if (parte.length <= tamanhoMaximo) {
            resultadoFinal.push(parte);
        } else {
            // Quebra forçada
            for (let i = 0; i < parte.length; i += tamanhoMaximo) {
                resultadoFinal.push(parte.substring(i, i + tamanhoMaximo).trim());
            }
        }
    });

    return resultadoFinal.filter(p => p.length > 0);
}

function resetarBotao(btn) {
    btn.classList.remove('falando');
    btn.innerText = "🔊 Ouvir Agenda";
    btn.disabled = false;
}