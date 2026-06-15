document.getElementById('btnFalarAgenda').addEventListener('click', async () => {
    const btn = document.getElementById('btnFalarAgenda');

    try {
        // --- LOG 1: Iniciando o processo ---
        console.log("[VoiceSystem] Iniciando busca pela agenda do dia...");
        btn.innerText = "Carregando...";

        const response = await fetch('/api/agendamentos/hoje');

        if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);

        const agenda = await response.json();

        // --- LOG 2: Dados recebidos ---
        console.log("[VoiceSystem] Dados recebidos da API:", agenda);

        let texto = "";
        if (agenda && agenda.length > 0) {
            texto = `Bom dia. Hoje você tem ${agenda.length} agendamentos. O próximo paciente é ${agenda[0].nome}.`;
        } else {
            texto = "Bom dia. Você não possui agendamentos marcados para hoje.";
        }

        // --- LOG 3: O texto que será "falado" ---
        console.log("[VoiceSystem] Texto pronto para síntese:", texto);

        const msg = new SpeechSynthesisUtterance(texto);
        msg.lang = 'pt-BR';
        msg.rate = 1.0;
        msg.pitch = 1.0;

        btn.classList.add('falando');
        btn.innerText = "🔊 Ouvindo Agenda...";

        msg.onstart = () => console.log("[VoiceSystem] Iniciando síntese de voz...");
        msg.onend = () => {
            console.log("[VoiceSystem] Síntese finalizada.");
            btn.classList.remove('falando');
            btn.innerText = "🔊 Ouvir Agenda";
        };

        window.speechSynthesis.speak(msg);

    } catch (error) {
        // --- LOG 4: Erro detalhado ---
        console.error("[VoiceSystem] ERRO CRÍTICO:", error.message);
        alert("Não foi possível carregar a agenda no momento.");
        btn.innerText = "🔊 Ouvir Agenda";
    }
});