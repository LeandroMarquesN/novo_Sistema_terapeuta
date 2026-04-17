const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuração do Multer (Upload de Arquivos) ---
// O path.join aqui sobe um nível (..) para criar a pasta na raiz do projeto
const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname);
  }
});

// --- AS LINHAS QUE ESTAVAM FALTANDO ABAIXO ---

// 3. Criamos a instância do multer com a configuração de storage
const upload = multer({ storage: storage });

// 4. EXPORTAMOS para que o agendamentoRoutes consiga usar
module.exports = upload;