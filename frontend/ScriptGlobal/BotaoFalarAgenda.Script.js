document.getElementById('btnFalarAgenda').addEventListener('click', async () => {
    const btn = document.getElementById('btnFalarAgenda');

    // Evita cliques múltiplos
    if (btn.classList.contains('falando') || btn.disabled) return;

    try {
        console.log("[VoiceSystem] Iniciando busca pela agenda do dia...");
        btn.disabled = true;
        btn.innerText = "Carregando...";

        // 1. Busca os dados
        const response = await fetch('/api/agendamentos/hoje');
        if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);

        const agendaCrua = await response.json();
        console.log("[VoiceSystem] Dados brutos recebidos da API:", agendaCrua);

        // Filtro de cancelados
        const agenda = agendaCrua.filter(item => item.status_agendamento !== 'cancelado');

        // 2. Monta o texto (mesma lógica que você já tinha)
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

        console.log("[VoiceSystem] Texto pronto para síntese:", texto);

        // 3. Função de fala mais robusta (funciona melhor em mobile)
        await falarTexto(texto, btn);

    } catch (error) {
        console.error("[VoiceSystem] ERRO CRÍTICO:", error);
        alert("Não foi possível processar a leitura da agenda.");
        resetarBotao(btn);
    }
});

/**
 * Função de fala otimizada para Desktop + Android + iOS
 */
function falarTexto(texto, btn) {
    return new Promise((resolve) => {
        // Cancela qualquer fala anterior
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.95;   // um pouco mais lento ajuda no mobile
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Tenta selecionar voz em português
        const aplicarVoz = () => {
            const vozes = window.speechSynthesis.getVoices();
            const vozPT = vozes.find(v =>
                v.lang === 'pt-BR' ||
                v.lang === 'pt_BR' ||
                v.lang.startsWith('pt')
            );
            if (vozPT) {
                utterance.voice = vozPT;
                console.log("[VoiceSystem] Voz selecionada:", vozPT.name);
            }
        };

        // Em muitos mobiles as vozes carregam assincronamente
        if (window.speechSynthesis.getVoices().length > 0) {
            aplicarVoz();
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                aplicarVoz();
            };
        }

        // Atualiza o botão
        btn.classList.add('falando');
        btn.innerText = "🔊 Ouvindo Agenda...";
        btn.disabled = true;

        // Eventos
        utterance.onstart = () => {
            console.log("[VoiceSystem] Fala iniciada");
        };

        utterance.onend = () => {
            console.log("[VoiceSystem] Fala finalizada");
            resetarBotao(btn);
            resolve();
        };

        utterance.onerror = (event) => {
            console.error("[VoiceSystem] Erro na fala:", event.error);
            resetarBotao(btn);
            resolve(); // resolve mesmo com erro para não travar
        };

        // Fala
        window.speechSynthesis.speak(utterance);

        // Truque importante para iOS e alguns Androids
        // (força o motor de voz a "acordar")
        setTimeout(() => {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        }, 100);

        // Timeout de segurança (caso o onend nunca dispare em algum aparelho)
        const tempoEstimado = Math.max(10000, texto.length * 70);
        setTimeout(() => {
            if (btn.classList.contains('falando')) {
                console.warn("[VoiceSystem] Timeout de segurança ativado");
                window.speechSynthesis.cancel();
                resetarBotao(btn);
                resolve();
            }
        }, tempoEstimado + 3000);
    });
}

function resetarBotao(btn) {
    btn.classList.remove('falando');
    btn.innerText = "🔊 Ouvir Agenda";
    btn.disabled = false;
}