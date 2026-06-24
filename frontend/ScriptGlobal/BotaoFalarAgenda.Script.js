document.getElementById('btnFalarAgenda').addEventListener('click', async () => {
    const btn = document.getElementById('btnFalarAgenda');

    try {
        console.log("[VoiceSystem] Iniciando busca pela agenda do dia...");
        btn.innerText = "Carregando...";

        const response = await fetch('/api/agendamentos/hoje');
        if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);

        const agendaCrua = await response.json();
        console.log("[VoiceSystem] Dados brutos recebidos da API:", agendaCrua);

        // 🌟 FILTRO PREVENTIVO: Ignora qualquer agendamento cancelado
        const agenda = agendaCrua.filter(item => item.status_agendamento !== 'cancelado');

        let texto = "";

        if (agenda && agenda.length > 0) {
            const total = agenda.length;

            if (total === 1) {
                texto = `Olá! Você tem 1 agendamento ativo para hoje. `;
            } else {
                texto = `Olá! Você tem ${total} agendamentos ativos para hoje. `;
            }

            texto += "A sua sequência de atendimentos é a seguinte: ";

            agenda.forEach((item, index) => {
                let horarioFalar = "";
                const dataEHora = item.data_agendamento || item.horario;

                // Extração inteligente do horário
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

                // 🌟 TRADUÇÃO DO STATUS PARA A FALA NATURAL
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

                // Monta a frase com o status injetado
                texto += `Às ${horarioFalar}, paciente ${nomePaciente}${statusTexto}. `;

                if (index < total - 1) {
                    texto += "Próximo atendimento: ";
                }
            });

            texto += " Tenha um excelente dia de atendimentos!";

        } else {
            texto = "Olá! Você não possui agendamentos ativos marcados para o dia de hoje. Aproveite o seu tempo livre!";
        }

        console.log("[VoiceSystem] Texto pronto para síntese (Filtrado):", texto);

        // Executa a síntese de voz nativa
        window.speechSynthesis.cancel();
        window.currentSpeechMsg = new SpeechSynthesisUtterance(texto);

        window.currentSpeechMsg.lang = 'pt-BR';
        window.currentSpeechMsg.rate = 1.0;
        window.currentSpeechMsg.pitch = 1.0;

        try {
            const vozes = window.speechSynthesis.getVoices();
            if (vozes && vozes.length > 0) {
                const vozPT = vozes.find(v => v.lang.includes('pt-BR'));
                if (vozPT) window.currentSpeechMsg.voice = vozPT;
            }
        } catch (e) {
            console.warn("[VoiceSystem] Falha ao mapear voz específica.");
        }

        btn.classList.add('falando');
        btn.innerText = "🔊 Ouvindo Agenda...";

        const fatiasTexto = texto.length;
        const tempoEstimado = Math.max(8000, fatiasTexto * 80);

        const timeoutSeguranca = setTimeout(() => {
            btn.classList.remove('falando');
            btn.innerText = "🔊 Ouvir Agenda";
        }, tempoEstimado);

        window.currentSpeechMsg.onstart = () => console.log("[VoiceSystem] Iniciando síntese de voz...");

        window.currentSpeechMsg.onend = () => {
            console.log("[VoiceSystem] Síntese finalizada com sucesso.");
            clearTimeout(timeoutSeguranca);
            btn.classList.remove('falando');
            btn.innerText = "🔊 Ouvir Agenda";
        };

        window.currentSpeechMsg.onerror = (err) => {
            console.error("[VoiceSystem] Erro na emissão da voz:", err);
            clearTimeout(timeoutSeguranca);
            btn.classList.remove('falando');
            btn.innerText = "🔊 Ouvir Agenda";
        };

        window.speechSynthesis.speak(window.currentSpeechMsg);

    } catch (error) {
        console.error("[VoiceSystem] ERRO CRÍTICO:", error.message);
        alert("Não foi possível processar a leitura da agenda.");
        btn.innerText = "🔊 Ouvir Agenda";
    }
});