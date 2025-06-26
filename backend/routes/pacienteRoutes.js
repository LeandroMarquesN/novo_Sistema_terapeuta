const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');

router.get('/', pacienteController.getAll);
router.post('/', pacienteController.create);

module.exports = router;
