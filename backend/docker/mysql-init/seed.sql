-- backend/docker/mysql-init/seed.sql
INSERT IGNORE INTO usuarios (id, clinica_id, nome, email, senha, cargo, criado_em) 
VALUES (2, NULL, 'Administrador MedLM', 'admin@medlm.com', 'mariarosa', 'dono', NOW());