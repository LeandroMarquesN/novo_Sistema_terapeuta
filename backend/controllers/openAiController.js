const pdf = require('pdf-parse');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

// Inicializa o cliente OpenAI com a chave da variável de ambiente
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

exports.analisarExame = async (req, res) => {
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
