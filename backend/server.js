const app = require('./app'); // Corrija o caminho do arquivo, se necessário

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta meu querido ${PORT}`);
});