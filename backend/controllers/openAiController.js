const pdf = require('pdf-parse');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

// Inicializa o cliente OpenAI com a chave da variável de ambiente
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

exports.analisarExame1 = async (req, res) => {
    // Verifica se o arquivo foi enviado
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    try {
        // Extrai o texto do PDF a partir do buffer de memória
        const data = await pdf(req.file.buffer);
        const textoExame = data.text;

        if (!textoExame.trim()) {
            return res.status(400).json({ error: 'Não foi possível extrair texto do PDF.' });
        }

        // Cria o prompt para a IA
        const prompt = `
        Analise o seguinte texto de exame laboratorial. Extraia os resultados, valores de referência e classifique cada um como 'Normal', 'Alto' ou 'Baixo'. Em seguida, forneça um diagnóstico geral e sugestões de tratamento ou acompanhamento. Formate sua resposta como um objeto JSON.

        Exemplo de formato JSON esperado:
        {
          "paciente_nome": "Nome do Paciente",
          "tipo_exame": "Tipo do Exame",
          "resultados": [
            {
              "nome": "Hemoglobina",
              "valor": "14.5 g/dL",
              "referencia": "13.5-17.5 g/dL",
              "status": "Normal"
            }
          ],
          "diagnostico": "Análise completa do diagnóstico aqui...",
          "sugestao_tratamento": "Sugestões de tratamento ou acompanhamento aqui..."
        }

        Texto para análise:
        ${textoExame}
        `;

        // Chama a API da OpenAI (GPT-4o)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Você é um assistente médico." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        // Retorna a análise da IA para o front-end
        const analise = completion.choices[0].message.content;
        return res.json({ analise: JSON.parse(analise) });

    } catch (error) {
        console.error('Erro no processamento do exame:', error);
        return res.status(500).json({ error: 'Erro interno ao processar o exame.', details: error.message });
    }
};

// ====================
exports.resumirAgenda = async (req, res) => {
    // LOG: Entrada na requisição
    console.log(`[LOG - ${new Date().toISOString()}] Recebendo solicitação de resumo de agenda.`);

    try {
        const { agendamentos } = req.body;

        // LOG: Validando dados de entrada
        if (!agendamentos || agendamentos.length === 0) {
            console.warn(`[WARN - ${new Date().toISOString()}] Agenda vazia recebida do front-end.`);
            return res.json({ resumo_falado: "Você não possui agendamentos marcados para hoje." });
        }

        console.log(`[LOG - ${new Date().toISOString()}] Processando ${agendamentos.length} agendamentos com a OpenAI.`);

        const prompt = `Você é um assistente pessoal de um médico. Resuma estes agendamentos de forma muito curta e profissional para uma leitura de voz: ${JSON.stringify(agendamentos)}`;

        // LOG: Iniciando chamada à OpenAI
        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }]
        });
        const duration = Date.now() - startTime;

        // LOG: Sucesso e tempo de resposta
        console.log(`[SUCCESS - ${new Date().toISOString()}] Resumo gerado em ${duration}ms.`);

        const resumo = completion.choices[0].message.content;
        return res.json({ resumo_falado: resumo });

    } catch (error) {
        // LOG: Erro crítico
        console.error(`[CRITICAL - ${new Date().toISOString()}] Erro ao gerar resumo de agenda:`, {
            message: error.message,
            stack: error.stack
        });

        return res.status(500).json({ error: 'Erro ao gerar resumo falado.' });
    }
};
// ====================

exports.analisarExame = async (req, res) => {
    // LOG: Entrada na requisição
    console.log(`[LOG - ${new Date().toISOString()}] Iniciando análise de exame.`);

    if (!req.file) {
        console.warn(`[WARN - ${new Date().toISOString()}] Falha: Nenhum arquivo enviado.`);
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    try {
        const data = await pdf(req.file.buffer);
        const textoExame = data.text;

        if (!textoExame.trim()) {
            console.error(`[ERROR - ${new Date().toISOString()}] PDF extraído, mas está vazio.`);
            return res.status(400).json({ error: 'Não foi possível extrair texto do PDF.' });
        }

        // LOG: Confirmando que o texto foi extraído
        console.log(`[LOG - ${new Date().toISOString()}] Texto extraído com sucesso (${textoExame.length} caracteres). Enviando para OpenAI...`);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Você é um assistente médico." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        // LOG: Sucesso na API
        console.log(`[SUCCESS - ${new Date().toISOString()}] OpenAI respondeu com sucesso.`);

        const analise = completion.choices[0].message.content;
        return res.json({ analise: JSON.parse(analise) });

    } catch (error) {
        // LOG: Capturando o erro real da OpenAI
        console.error(`[CRITICAL - ${new Date().toISOString()}] Erro na OpenAI API:`, {
            message: error.message,
            type: error.type,
            code: error.code
        });

        return res.status(500).json({
            error: 'Erro interno ao processar o exame.',
            details: error.message
        });
    }
};