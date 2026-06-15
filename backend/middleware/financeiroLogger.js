const financeiroLogger = (req, res, next) => {
    const start = Date.now();

    // Quando a resposta terminar, logamos o que aconteceu
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[FINANCEIRO LOG] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Tempo: ${duration}ms`);

        if (res.statusCode >= 400) {
            console.warn(`⚠️ ATENÇÃO: Erro detectado na rota ${req.originalUrl}`);
        }
    });

    next();
};

module.exports = financeiroLogger;
