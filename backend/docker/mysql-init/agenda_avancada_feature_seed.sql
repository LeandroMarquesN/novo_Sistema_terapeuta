-- =============================================================================
-- SEED: registra a feature "Agenda Avançada" no sistema de Feature Flags
-- Rode este script uma única vez (idempotente por causa do INSERT IGNORE).
-- =============================================================================

INSERT IGNORE INTO features (nome_tecnico, descricao) VALUES
('agenda_avancada', 'Agenda avançada: grade horária dark mode, panorama anual e drag-and-drop');

-- Define o padrão por plano (ajuste conforme a régua comercial da MedLM):
-- TRIAL: desabilitado | PREMIUM: habilitado | ENTERPRISE: habilitado
INSERT IGNORE INTO plano_features (plano_id, feature_id, is_enabled)
SELECT p.id,
       f.id,
       CASE WHEN p.nome_plano = 'trial' THEN FALSE ELSE TRUE END
FROM planos p
JOIN features f ON f.nome_tecnico = 'agenda_avancada';

-- Para liberar manualmente em UMA clínica específica (override), independente do plano:
-- INSERT INTO clinica_features (clinica_id, feature_id, is_enabled)
-- SELECT <ID_DA_CLINICA>, id, TRUE FROM features WHERE nome_tecnico = 'agenda_avancada'
-- ON DUPLICATE KEY UPDATE is_enabled = TRUE;
