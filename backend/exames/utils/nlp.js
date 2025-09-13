const { PythonShell } = require('python-shell');
const path = require('path');

/**
 * Processa um texto de exame usando um script Python com spaCy.
 *
 * @param {string} rawText O texto bruto extraído do PDF pelo OCR.
 * @returns {Promise<object>} Um objeto com os dados do exame e o diagnóstico.
 */
async function processTextWithSpacy(rawText) {
  return new Promise((resolve, reject) => {
    // Configura as opções para a execução do script Python
    const options = {
      mode: 'text',
      pythonPath: 'python', // Ou o caminho para o seu executável python
      scriptPath: path.join(__dirname, '.'), // O caminho do script Python
      args: [], // Argumentos a serem passados para o script, se necessário
    };

    // Cria uma nova instância do PythonShell
    const pyshell = new PythonShell('nlp_processor.py', options);

    // Envia o texto bruto para o script Python através do stdin
    pyshell.send(rawText);

    let output = '';
    // Recebe a saída do script Python (stdout)
    pyshell.on('message', function (message) {
      output += message;
    });

    // Finaliza a execução do PythonShell e resolve a Promise
    pyshell.end(function (err) {
      if (err) {
        return reject(err);
      }
      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (parseErr) {
        reject(new Error('Erro ao analisar a saída JSON do script Python: ' + parseErr.message));
      }
    });
  });
}

module.exports = {
  processTextWithSpacy,
};
