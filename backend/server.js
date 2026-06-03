// backend/server.js
const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const verde = "\x1b[32m";
  const azul = "\x1b[34m";
  const reset = "\x1b[0m";
  const negrito = "\x1b[1m";

  console.clear(); // Limpa o terminal antes de mostrar
  console.log(`
${azul}${negrito}  ___________________________________________________
 |                                                   |
 |   ${verde}⚕️  MED-LM : GESTÃO CLÍNICA INTELIGENTE${azul}         |
 |___________________________________________________|${reset}
 |                                                   |
 |  ${negrito}Status:${reset} ${verde}ON (Online)${reset}                          |
 |  ${negrito}Porta:${reset}  ${azul}${PORT}${reset}                                   |
 |  ${negrito}Modo:${reset}   Desenvolvimento                         |
 |  ${negrito}Aviso:${reset}  Servidor rodando, meu querido!         |
 |___________________________________________________|
  `);
  console.log(`
  =================================================
     __  __           _ _      __  __
    |  \\/  |         | | |    |  \\/  |
    | \\  / | ___   __| | |    | \\  / |
    | |\\/| |/ _ \\ / _\` | |    | |\\/| |
    | |  | |  __/| (_| | |____| |  | |
    |_|  |_|\\___| \\__,_|______|_|  |_|

    SISTEMA CLÍNICO INTELIGENTE CONECTADO
  =================================================
  🚀 Servidor rodando na porta ${PORT} sistema_limpeza!
  🕗 Horário local: ${new Date().toLocaleTimeString()}
  =================================================
  `);
});