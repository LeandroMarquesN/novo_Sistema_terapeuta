// controllers/exameController.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.processarExame = (req, res) => {
  console.log('--- Processando Exame ---');

  if (!req.files || !req.files.exame) {
    return res.status(400).json({ error: 'Nenhum arquivo de exame foi enviado.' });
  }

  const exameFile = req.files.exame[0];
  const pythonScriptPath = path.join(__dirname, '..', '..', 'utils', 'nlp_processor.py');
  const uploadedFilePath = exameFile.path;

  // Verifica se o script Python existe
  if (!fs.existsSync(pythonScriptPath)) {
    console.error(`Erro: O arquivo do script Python não foi encontrado em: ${pythonScriptPath}`);
    return res.status(500).json({ error: 'Script de processamento não encontrado no servidor.' });
  }

  console.log(`Executando o script Python: ${pythonScriptPath}`);
  console.log(`Caminho do arquivo de exame: ${uploadedFilePath}`);

  const pythonProcess = spawn('python3', [pythonScriptPath, uploadedFilePath]);

  let pythonOutput = '';
  let pythonError = '';

  // Captura a saída padrão do script Python
  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  // Captura os erros do script Python
  pythonProcess.stderr.on('data', (data) => {
    pythonError += data.toString();
  });

  // Evento de fechamento do processo
  pythonProcess.on('close', (code) => {
    console.log(`Processo Python finalizado com código: ${code}`);

    // Se o código for diferente de 0, significa que houve um erro
    if (code !== 0) {
      console.error('Erro no script Python:');
      console.error(pythonError);
      return res.status(500).json({ error: 'Erro no processamento do exame.', details: pythonError });
    }

    console.log('Saída do script Python:');
    console.log(pythonOutput);

    // Retorna a saída do script Python como resposta
    res.json({ resultado: pythonOutput });
  });

  // Evento de erro geral (ex: python3 não encontrado)
  pythonProcess.on('error', (err) => {
    console.error('Falha ao iniciar o processo Python:', err);
    res.status(500).json({ error: 'Falha ao iniciar o processo de análise de exames.' });
  });
};
