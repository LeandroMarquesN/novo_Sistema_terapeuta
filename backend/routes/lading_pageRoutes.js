const express = require('express');
const router = express.Router();
const path = require('path');
const pagesPath = path.resolve(__dirname, '..', '..', 'frontend', 'pages');




// --- AQUI ESTAVA FALTANDO ESSA IMPORTAÇÃO ---
const listaEsperaController = require('../controllers/listaEsperaController');

// Rota raiz do sub-roteador (que será acessada pelo '/programa-fundadores')
router.get('/', (req, res) => {
    res.sendFile(path.join(pagesPath, 'lading_Page.html'));
});


router.post('/salvar', listaEsperaController.salvarInteressado);


module.exports = router;