
<<<<<<< HEAD


const app = require('../backend/app');
=======
// backend/server.js

const app = require('./app');
>>>>>>> 3959620b0900f06c3eea4d8f921ebede1266b5c5
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta meu querido ${PORT}`);
});
