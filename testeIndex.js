// testeIndex.js

const fs = require('fs');
const path = require('path');

const caminhoIndex = path.join(__dirname, 'frontend', 'pages', 'index.html');

fs.access(caminhoIndex, fs.constants.F_OK, (err) => {
  if (err) {
    console.error("❌ Arquivo index.html não encontrado!");
  } else {
    console.log("✅ Arquivo index.html encontrado com sucesso!");
  }
});
// anotacao para o vlume do docker se der errado:
// volumes:
// - ./ backend: /app
//   - /app/node_modules
//   - ./ frontend: /app/frontend
//     - ./ backend / uploads: /app/uploads # Mapeamento explícito para uploads