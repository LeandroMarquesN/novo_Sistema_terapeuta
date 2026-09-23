CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;

-- 1. TABELA DE PLANOS
CREATE TABLE IF NOT EXISTS planos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_plano ENUM('trial', 'premium', 'enterprise') NOT NULL,
    valor_base DECIMAL(10,2) NOT NULL,
    valor_promocional DECIMAL(10,2) NOT NULL,
    limite_membros INT NOT NULL
) ENGINE=InnoDB;

-- 2. INSERIR OS VALORES DOS PLANOS
INSERT IGNORE INTO planos (id, nome_plano, valor_base, valor_promocional, limite_membros) VALUES
(1, 'trial', 109.90, 89.90, 3),
(2, 'premium', 169.90, 89.90, 10),
(3, 'enterprise', 269.90, 89.90, 50);

-- 2.1  LISTA DE ESPERA DE FUNDADORES DO MED LM
CREATE TABLE IF NOT EXISTS lista_espera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_clinica VARCHAR(100) NOT NULL,
    responsavel VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('pendente', 'contatado', 'convertido') DEFAULT 'pendente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE CLÍNICAS
CREATE TABLE IF NOT EXISTS clinicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_clinica VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  dono_nome VARCHAR(100) NOT NULL,
  telefone_clinica VARCHAR(20) NOT NULL,
  telefone_dono VARCHAR(20) NOT NULL,
  email_master VARCHAR(100) NOT NULL UNIQUE,
  senha_master VARCHAR(255) NOT NULL,
  plano_id INT NOT NULL,
  
  gateway_id VARCHAR(255) NULL,
  tipo_plano ENUM('FUNDADOR', 'PADRAO') DEFAULT 'PADRAO',
  data_inicio_trial DATE NULL,
  asaas_customer_id VARCHAR(100) NULL,
  asaas_subscription_id VARCHAR(100) NULL,
  status_pagamento ENUM('trial', 'ativo', 'inadimplente', 'cancelado') DEFAULT 'trial',
  data_fim_gratuidade DATE NULL,
  data_fim_promocao DATE NULL,
  valor_atual DECIMAL(10,2) DEFAULT 89.90,
  status ENUM('ativo', 'inadimplente', 'suspenso', 'cancelado') DEFAULT 'ativo',
  data_cadastro DATE DEFAULT (CURRENT_DATE),
  data_expiracao DATE NOT NULL,
  data_cancelamento DATE DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_clinica_plano FOREIGN KEY (plano_id) REFERENCES planos(id)
) ENGINE=InnoDB;

-- 4. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_expires DATETIME DEFAULT NULL,
    current_session_token VARCHAR(255) DEFAULT NULL,

    certificado_a1_blob LONGBLOB NULL COMMENT 'Arquivo .pfx do certificado digital',
    certificado_senha VARCHAR(255) NULL COMMENT 'Senha de uso do certificado A1',
    certificado_vencimento DATETIME NULL COMMENT 'Data de expiração do certificado',
    tipo_assinatura ENUM('a1', 'nuvem') DEFAULT 'a1' COMMENT 'Modelo de assinatura escolhido pelo profissional',
    cloud_token_ref VARCHAR(255) NULL COMMENT 'Token ou ID de referência para API de assinatura em nuvem',

    cargo ENUM(
        'dono',
        'admin',
        'recepcao',
        'terapeuta',
        'medico',
        'psicologo',
        'fisioterapeuta',
        'nutricionista',
        'fonoaudiologo',
        'profissional da saude'
    ) DEFAULT 'terapeuta',
    crm VARCHAR(20) NULL,
    uf_crm CHAR(2) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. PACIENTES
CREATE TABLE IF NOT EXISTS pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  cpf VARCHAR(14),
  email VARCHAR(100),
  telefone VARCHAR(20),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  peso DECIMAL(5,2),
  genero VARCHAR(20),
  status_pagamento VARCHAR(20) DEFAULT 'pendente',
  origem ENUM('portal', 'manual', 'indicacao') DEFAULT 'manual',
  altura DECIMAL(5,2),
  condicoes_preexistentes TEXT,
  foto_perfil VARCHAR(255),
  permitir_ver_prontuario TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Permite ver prontuários, 0 = Oculta',
  aceite_lgpd TINYINT(1) NOT NULL DEFAULT 0,
  data_aceite_lgpd TIMESTAMP NULL DEFAULT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  arquivado_em DATETIME NULL,
  arquivado_por INT NULL,
  motivo_arquivamento VARCHAR(255) NULL,
  token_acesso VARCHAR(128) DEFAULT NULL,
  token_expiracao DATETIME DEFAULT NULL,
  aceita_marketing TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_acesso (token_acesso),
  CONSTRAINT fk_paciente_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paciente_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NOT NULL,
    paciente_id INT NOT NULL,
    nome_original VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NULL,
    tamanho_bytes INT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pac_doc_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
    CONSTRAINT fk_pac_doc_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  data_agendamento DATETIME NOT NULL,
  status_agendamento ENUM('aguardando_sinal', 'confirmado', 'cancelado', 'finalizado','nao_compareceu') DEFAULT 'aguardando_sinal',
  nome VARCHAR(100),
  email VARCHAR(100),
  telefone VARCHAR(20),
  cpf VARCHAR(14),
  genero VARCHAR(20),
  tipo_terapia VARCHAR(100),
  motivo_consulta TEXT,
  origem_indicacao VARCHAR(100),
  peso DECIMAL(5,2),
  altura DECIMAL(5,2),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  condicoes TEXT,
  duracao_minutos INT UNSIGNED NULL DEFAULT 50 COMMENT 'Duração em minutos (Agenda Avançada)',
  slot_ativo DATETIME GENERATED ALWAYS AS (
    CASE WHEN status_agendamento <> 'cancelado' THEN data_agendamento ELSE NULL END
  ) STORED,
  CONSTRAINT fk_agend_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_agend_clinica_horario_ativo (clinica_id, slot_ativo)
) ENGINE=InnoDB;

-- CONFIGURAÇÕES
CREATE TABLE IF NOT EXISTS clinica_configuracoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  horario_abertura TIME DEFAULT '08:00:00',
  horario_fechamento TIME DEFAULT '18:00:00',
  duracao_atendimento INT DEFAULT 30,
  valor_sinal DECIMAL(10,2) DEFAULT 0.00,
  dias_semana VARCHAR(50) DEFAULT '1,2,3,4,5',
  intervalos_pausa JSON DEFAULT NULL,
  periodos_fechados JSON DEFAULT NULL,
  UNIQUE KEY uq_config_clinica (clinica_id),
  CONSTRAINT fk_config_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. FEATURE FLAGS
CREATE TABLE IF NOT EXISTS features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_tecnico VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plano_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plano_id INT NOT NULL,
    feature_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    CONSTRAINT fk_plano_feat_plano FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE CASCADE,
    CONSTRAINT fk_plano_feat_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinica_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NOT NULL,
    feature_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    CONSTRAINT fk_clinica_feat_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
    CONSTRAINT fk_clinica_feat_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. FINANCEIRO
CREATE TABLE IF NOT EXISTS financeiro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  usuario_id INT NULL,
  gateway_id VARCHAR(255) NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NULL,
  tipo ENUM('receita', 'despesa') NOT NULL DEFAULT 'receita',
  categoria VARCHAR(100) NOT NULL DEFAULT 'Consulta',
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE NULL,
  status_pagamento ENUM('aberto', 'pago', 'atrasado', 'estornado', 'cancelado') DEFAULT 'aberto',
  metodo_pagamento ENUM('pix', 'cartao', 'dinheiro', 'boleto'),
  observacoes TEXT NULL,
  link_pagamento TEXT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fin_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. DESPESAS
CREATE TABLE IF NOT EXISTS financeiro_despesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  categoria ENUM('marketing', 'fixa', 'variavel') NOT NULL,
  data_vencimento DATE NOT NULL,
  status_pagamento ENUM('aberto', 'pago') DEFAULT 'aberto',
  CONSTRAINT fk_despesa_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. ANEXOS
CREATE TABLE IF NOT EXISTS anexos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NOT NULL,
  nome_original VARCHAR(255),
  caminho_servidor VARCHAR(255),
  mime_type VARCHAR(50),
  tamanho_bytes INT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_anexo_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexo_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexo_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. PRONTUÁRIOS
CREATE TABLE IF NOT EXISTS prontuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  agendamento_id INT NULL,
  texto_evolucao LONGTEXT NOT NULL,
  diagnostico_cid VARCHAR(10) NULL,
  status_prontuario ENUM('rascunho', 'finalizado') DEFAULT 'rascunho',
  data_atendimento DATETIME NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prontuario_paciente (paciente_id),
  INDEX idx_prontuario_clinica (clinica_id),
  CONSTRAINT fk_pront_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 🛡️ AUDITORIA (já modernizada)
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo_documento ENUM('prontuario','receita','atestado','solicitacao_exame') NOT NULL DEFAULT 'prontuario',
  documento_id INT NULL,
  prontuario_id INT NULL,                    -- mantido por compatibilidade
  acao VARCHAR(50) NOT NULL,
  data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  crm VARCHAR(30) NULL,
  uf_crm CHAR(2) NULL,
  INDEX idx_log_tipo_doc (tipo_documento, documento_id),
  CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_log_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  tipo ENUM('agendamento', 'documento', 'sistema') NOT NULL DEFAULT 'sistema',
  titulo VARCHAR(150) NOT NULL,
  mensagem VARCHAR(500) NOT NULL,
  referencia_id INT NULL,
  paciente_id INT NULL,
  lida TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clinica_lida (clinica_id, lida),
  INDEX idx_clinica_criado (clinica_id, criado_em DESC),
  CONSTRAINT fk_notif_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 11. MARKETING
CREATE TABLE IF NOT EXISTS marketing_campanhas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  criado_por_usuario_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  assunto VARCHAR(200) NOT NULL,
  corpo_html LONGTEXT NOT NULL,
  tipo_publico ENUM('todos', 'individual', 'filtro') NOT NULL DEFAULT 'todos',
  filtro_json JSON NULL,
  status ENUM('rascunho', 'processando', 'concluida', 'concluida_com_falhas', 'falhou') NOT NULL DEFAULT 'rascunho',
  total_destinatarios INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_falhas INT NOT NULL DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  iniciado_em DATETIME NULL,
  concluido_em DATETIME NULL,
  CONSTRAINT fk_mkt_camp_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_camp_usuario FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS marketing_envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campanha_id INT NOT NULL,
  paciente_id INT NOT NULL,
  email_destino VARCHAR(150) NOT NULL,
  status ENUM('pendente', 'enviado', 'falhou', 'pulado_optout') NOT NULL DEFAULT 'pendente',
  erro TEXT NULL,
  enviado_em DATETIME NULL,
  INDEX idx_campanha_status (campanha_id, status),
  CONSTRAINT fk_mkt_envio_campanha FOREIGN KEY (campanha_id) REFERENCES marketing_campanhas(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_envio_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 12. RECEITUÁRIO DIGITAL
-- ============================================================
CREATE TABLE IF NOT EXISTS receitas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  agendamento_id INT NULL,
  prontuario_id INT NULL,
  profissional_nome VARCHAR(100) NOT NULL,
  profissional_crm VARCHAR(20) NULL,
  profissional_uf_crm CHAR(2) NULL,
  observacoes TEXT NULL,
  validade_dias INT UNSIGNED DEFAULT 30,
  status_receita ENUM('rascunho', 'emitido', 'cancelado') NOT NULL DEFAULT 'rascunho',
  data_emissao DATETIME NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_receita_clinica (clinica_id),
  INDEX idx_receita_paciente (paciente_id),
  INDEX idx_receita_usuario (usuario_id),
  INDEX idx_receita_status (status_receita),
  CONSTRAINT fk_receita_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_receita_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_receita_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_receita_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_receita_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS receita_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receita_id INT NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 1,
  medicamento_nome VARCHAR(200) NOT NULL,
  concentracao VARCHAR(100) NULL,
  forma_farmaceutica VARCHAR(80) NULL,
  quantidade VARCHAR(50) NOT NULL,
  posologia TEXT NOT NULL,
  via_administracao VARCHAR(50) NULL,
  uso_continuo TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item_receita (receita_id),
  CONSTRAINT fk_item_receita FOREIGN KEY (receita_id) REFERENCES receitas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 13. ATESTADOS MÉDICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS atestados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  agendamento_id INT NULL,
  prontuario_id INT NULL,
  profissional_nome VARCHAR(100) NOT NULL,
  profissional_crm VARCHAR(20) NULL,
  profissional_uf_crm CHAR(2) NULL,
  tipo_atestado ENUM('afastamento', 'comparecimento', 'acompanhante', 'outro') NOT NULL DEFAULT 'afastamento',
  dias_afastamento INT UNSIGNED NULL,
  data_inicio DATE NULL,
  data_fim DATE NULL,
  cid VARCHAR(10) NULL,
  texto_livre TEXT NULL,
  local_atendimento VARCHAR(150) NULL,
  status_atestado ENUM('rascunho', 'emitido', 'cancelado') NOT NULL DEFAULT 'rascunho',
  data_emissao DATETIME NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_atestado_clinica (clinica_id),
  INDEX idx_atestado_paciente (paciente_id),
  INDEX idx_atestado_status (status_atestado),
  CONSTRAINT fk_atestado_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_atestado_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_atestado_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_atestado_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_atestado_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 14. SOLICITAÇÃO DE EXAMES / VITAMINAS
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitacoes_exames (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  agendamento_id INT NULL,
  prontuario_id INT NULL,
  profissional_nome VARCHAR(100) NOT NULL,
  profissional_crm VARCHAR(20) NULL,
  profissional_uf_crm CHAR(2) NULL,
  titulo VARCHAR(150) NULL,
  observacoes TEXT NULL,
  prioridade ENUM('rotina', 'urgente') NOT NULL DEFAULT 'rotina',
  status_solicitacao ENUM('rascunho', 'emitido', 'cancelado') NOT NULL DEFAULT 'rascunho',
  data_emissao DATETIME NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sol_clinica (clinica_id),
  INDEX idx_sol_paciente (paciente_id),
  INDEX idx_sol_status (status_solicitacao),
  CONSTRAINT fk_sol_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_sol_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_sol_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_sol_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_sol_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS solicitacao_exame_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitacao_id INT NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 1,
  categoria VARCHAR(80) NOT NULL,
  nome_exame VARCHAR(200) NOT NULL,
  codigo_tuss VARCHAR(20) NULL,
  instrucoes TEXT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item_sol (solicitacao_id),
  CONSTRAINT fk_item_sol FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_exames(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 15. CATÁLOGO INTELIGENTE DE EXAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS catalogo_exames (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NULL,
  categoria VARCHAR(80) NOT NULL,
  nome_exame VARCHAR(200) NOT NULL,
  codigo_tuss VARCHAR(20) NULL,
  instrucoes_padrao TEXT NULL,
  pacote_sugerido VARCHAR(100) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cat_categoria (categoria),
  INDEX idx_cat_pacote (pacote_sugerido),
  CONSTRAINT fk_cat_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- INSERTS DE TESTE
-- ============================================================
INSERT IGNORE INTO clinicas (id, nome_clinica, slug, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master, plano_id, data_expiracao)
VALUES (1, 'Clínica Experimental', 'clinica-experimental', 'Leandro Marques', '1199999999', '1188888888', 'admin@sistema.com', '123456', 1, '2026-12-31');

INSERT IGNORE INTO usuarios (clinica_id, nome, email, senha, cargo)
VALUES (1, 'Leandro Marques', 'leandro@teste.com', '123456', 'dono');

INSERT IGNORE INTO usuarios (clinica_id, nome, email, senha, cargo)
VALUES (NULL, 'Administrador MedLM', 'admin@medlm.com', 'mariarosa', 'dono');

INSERT IGNORE INTO features (nome_tecnico, descricao) VALUES
('portal_paciente', 'Permite acesso ao portal de agendamento'),
('notificacao_whatsapp', 'Envio automático de lembretes'),
('relatorios_avancados', 'Dashboards financeiros completos');

INSERT IGNORE INTO plano_features (plano_id, feature_id, is_enabled) VALUES
(1, 1, true), (1, 2, false), (1, 3, false),
(2, 1, true), (2, 2, true), (2, 3, false),
(3, 1, true), (3, 2, true), (3, 3, true);

-- ============================================================
-- SEED DO CATÁLOGO DE EXAMES (Clínico Geral)
-- ============================================================
INSERT IGNORE INTO catalogo_exames (clinica_id, categoria, nome_exame, instrucoes_padrao, pacote_sugerido) VALUES
(NULL, 'Hemograma', 'Hemograma completo', 'Jejum não obrigatório', 'Check-up Básico'),
(NULL, 'Hemograma', 'Contagem de plaquetas', NULL, 'Check-up Básico'),
(NULL, 'Bioquímica', 'Glicemia de jejum', 'Jejum de 8–12 horas', 'Check-up Básico'),
(NULL, 'Bioquímica', 'Ureia', 'Jejum de 8 horas', 'Check-up Básico'),
(NULL, 'Bioquímica', 'Creatinina', 'Jejum de 8 horas', 'Check-up Básico'),
(NULL, 'Bioquímica', 'Ácido úrico', 'Jejum de 8 horas', NULL),
(NULL, 'Bioquímica', 'TGO (AST)', 'Jejum de 8 horas', 'Check-up Básico'),
(NULL, 'Bioquímica', 'TGP (ALT)', 'Jejum de 8 horas', 'Check-up Básico'),
(NULL, 'Bioquímica', 'Gama-GT', 'Jejum de 8 horas', NULL),
(NULL, 'Bioquímica', 'Fosfatase alcalina', 'Jejum de 8 horas', NULL),
(NULL, 'Bioquímica', 'Bilirrubinas totais e frações', 'Jejum de 8 horas', NULL),
(NULL, 'Perfil Lipídico', 'Colesterol total', 'Jejum de 12 horas', 'Check-up Básico'),
(NULL, 'Perfil Lipídico', 'HDL-colesterol', 'Jejum de 12 horas', 'Check-up Básico'),
(NULL, 'Perfil Lipídico', 'LDL-colesterol', 'Jejum de 12 horas', 'Check-up Básico'),
(NULL, 'Perfil Lipídico', 'Triglicerídeos', 'Jejum de 12 horas', 'Check-up Básico'),
(NULL, 'Vitaminas e Minerais', 'Vitamina D (25-OH)', 'Jejum não obrigatório', 'Painel Vitaminas'),
(NULL, 'Vitaminas e Minerais', 'Vitamina B12', 'Jejum de 8 horas', 'Painel Vitaminas'),
(NULL, 'Vitaminas e Minerais', 'Ácido fólico', 'Jejum de 8 horas', 'Painel Vitaminas'),
(NULL, 'Vitaminas e Minerais', 'Ferro sérico', 'Jejum de 8 horas', 'Painel Vitaminas'),
(NULL, 'Vitaminas e Minerais', 'Ferritina', 'Jejum de 8 horas', 'Painel Vitaminas'),
(NULL, 'Vitaminas e Minerais', 'Zinco', 'Jejum de 8 horas', NULL),
(NULL, 'Vitaminas e Minerais', 'Magnésio', 'Jejum de 8 horas', NULL),
(NULL, 'Tireoide', 'TSH', 'Jejum não obrigatório', 'Painel Tireoide'),
(NULL, 'Tireoide', 'T4 livre', 'Jejum não obrigatório', 'Painel Tireoide'),
(NULL, 'Tireoide', 'T3 livre', 'Jejum não obrigatório', 'Painel Tireoide'),
(NULL, 'Sorologias', 'HIV (anti-HIV)', 'Jejum não obrigatório', 'Painel DST'),
(NULL, 'Sorologias', 'VDRL / Sífilis', 'Jejum não obrigatório', 'Painel DST'),
(NULL, 'Sorologias', 'HBsAg (Hepatite B)', 'Jejum não obrigatório', 'Painel DST'),
(NULL, 'Sorologias', 'Anti-HCV (Hepatite C)', 'Jejum não obrigatório', 'Painel DST'),
(NULL, 'Sorologias', 'Anti-HBs', 'Jejum não obrigatório', NULL),
(NULL, 'Urina e Fezes', 'EAS (Urina tipo I)', 'Primeira urina da manhã', 'Check-up Básico'),
(NULL, 'Urina e Fezes', 'Cultura de urina', 'Coleta asséptica', NULL),
(NULL, 'Urina e Fezes', 'Parasitológico de fezes', 'Amostra fresca', 'Check-up Básico'),
(NULL, 'Urina e Fezes', 'Pesquisa de sangue oculto nas fezes', 'Dieta prévia se necessário', NULL);
-- ============================================================
-- 16. MODELOS DE ANAMNESE (por profissão)
-- ============================================================

CREATE TABLE IF NOT EXISTS modelos_anamnese (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NULL COMMENT 'NULL = modelo do sistema; preenchido = custom da clínica',
  profissao VARCHAR(60) NOT NULL,
  nome VARCHAR(150) NOT NULL,
  descricao VARCHAR(255) NULL,
  icone VARCHAR(60) DEFAULT 'fa-clipboard-list',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT UNSIGNED NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_modelo_profissao (profissao),
  INDEX idx_modelo_clinica (clinica_id),
  CONSTRAINT fk_modelo_anamnese_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS modelos_anamnese_campos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modelo_id INT NOT NULL,
  secao VARCHAR(120) NULL,
  tipo ENUM('titulo','checkbox','texto','textarea','select','numero','escala') NOT NULL DEFAULT 'texto',
  rotulo VARCHAR(255) NOT NULL,
  placeholder VARCHAR(255) NULL,
  opcoes JSON NULL COMMENT 'Para select/checkbox múltiplo: ["A","B"]',
  obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
  ordem INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_campo_modelo FOREIGN KEY (modelo_id) REFERENCES modelos_anamnese(id) ON DELETE CASCADE,
  INDEX idx_campo_modelo_ordem (modelo_id, ordem)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS anamneses_preenchidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  agendamento_id INT NULL,
  prontuario_id INT NULL,
  modelo_id INT NOT NULL,
  respostas JSON NOT NULL,
  status_anamnese ENUM('rascunho','finalizado') NOT NULL DEFAULT 'rascunho',
  data_preenchimento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_anamnese_paciente (paciente_id),
  INDEX idx_anamnese_clinica (clinica_id),
  INDEX idx_anamnese_modelo (modelo_id),
  INDEX idx_anamnese_prontuario (prontuario_id),
  CONSTRAINT fk_anamnese_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_anamnese_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_anamnese_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_anamnese_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_anamnese_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_anamnese_modelo FOREIGN KEY (modelo_id) REFERENCES modelos_anamnese(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Seeds dos 5 modelos de sistema
INSERT IGNORE INTO modelos_anamnese (id, clinica_id, profissao, nome, descricao, icone, ordem) VALUES
(1, NULL, 'medico', 'Clínico Geral', 'Queixa, HDA, antecedentes, medicações e alergias', 'fa-user-md', 1),
(2, NULL, 'psicologo', 'Psicologia / Psicanálise', 'Queixa, humor, sono, suporte e histórico emocional', 'fa-brain', 2),
(3, NULL, 'fisioterapeuta', 'Fisioterapia', 'Dor (EVA), postura, amplitude e histórico ortopédico', 'fa-walking', 3),
(4, NULL, 'nutricionista', 'Nutrição', 'Recordatório, alergias, objetivos e hábitos', 'fa-apple-alt', 4),
(5, NULL, 'dentista', 'Odontologia', 'Queixa oral, higiene, alergias e antecedentes', 'fa-tooth', 5),
(6, NULL, 'terapeuta', 'Terapia / Holístico', 'Queixa, objetivos, histórico emocional e hábitos de vida', 'fa-hands-helping', 6),
(7, NULL, 'esteticista', 'Estética', 'Queixa estética, pele, procedimentos e contraindicações', 'fa-spa', 7),
(8, NULL, 'fonoaudiologo', 'Fonoaudiologia', 'Comunicação, deglutição, audição e desenvolvimento', 'fa-comment-medical', 8);

-- Campos: Clínico Geral (modelo 1)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(1, 'Identificação da queixa', 'textarea', 'Queixa principal', 'Descreva a queixa principal do paciente...', NULL, 1, 1),
(1, 'Identificação da queixa', 'textarea', 'História da doença atual (HDA)', 'Início, evolução, fatores de melhora/piora...', NULL, 1, 2),
(1, 'Antecedentes', 'checkbox', 'Hipertensão arterial', NULL, NULL, 0, 10),
(1, 'Antecedentes', 'checkbox', 'Diabetes mellitus', NULL, NULL, 0, 11),
(1, 'Antecedentes', 'checkbox', 'Cardiopatia', NULL, NULL, 0, 12),
(1, 'Antecedentes', 'checkbox', 'Asma / DPOC', NULL, NULL, 0, 13),
(1, 'Antecedentes', 'checkbox', 'Tireoidopatia', NULL, NULL, 0, 14),
(1, 'Antecedentes', 'checkbox', 'Cirurgias prévias', NULL, NULL, 0, 15),
(1, 'Antecedentes', 'textarea', 'Outros antecedentes / observações', NULL, NULL, 0, 16),
(1, 'Medicações e alergias', 'textarea', 'Medicações em uso', 'Nome, dose e posologia...', NULL, 0, 20),
(1, 'Medicações e alergias', 'texto', 'Alergias medicamentosas', 'Ex: dipirona, penicilina...', NULL, 0, 21),
(1, 'Hábitos', 'select', 'Tabagismo', NULL, '["Nunca","Ex-fumante","Atual"]', 0, 30),
(1, 'Hábitos', 'select', 'Etilismo', NULL, '["Não","Social","Frequente"]', 0, 31),
(1, 'Hábitos', 'select', 'Atividade física', NULL, '["Sedentário","Leve","Moderada","Intensa"]', 0, 32),
(1, 'Revisão de sistemas', 'textarea', 'Sintomas associados', 'Febre, emagrecimento, dor, dispneia...', NULL, 0, 40);

-- Campos: Psicologia (modelo 2)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(2, 'Queixa', 'textarea', 'Queixa / motivo da consulta', NULL, NULL, 1, 1),
(2, 'Queixa', 'textarea', 'História do problema atual', 'Quando começou, gatilhos, evolução...', NULL, 1, 2),
(2, 'Estado emocional', 'escala', 'Humor (0–10)', '0 = muito baixo · 10 = muito elevado', NULL, 0, 10),
(2, 'Estado emocional', 'escala', 'Ansiedade (0–10)', NULL, NULL, 0, 11),
(2, 'Estado emocional', 'select', 'Qualidade do sono', NULL, '["Boa","Regular","Ruim","Insônia"]', 0, 12),
(2, 'Estado emocional', 'checkbox', 'Ideação suicida / autolesão (avaliar risco)', NULL, NULL, 0, 13),
(2, 'Contexto', 'textarea', 'Suporte social / rede de apoio', NULL, NULL, 0, 20),
(2, 'Contexto', 'textarea', 'Histórico familiar relevante', NULL, NULL, 0, 21),
(2, 'Contexto', 'textarea', 'Tratamentos anteriores', 'Terapias, medicações psiquiátricas...', NULL, 0, 22),
(2, 'Observações', 'textarea', 'Observações do profissional', NULL, NULL, 0, 30);

-- Campos: Fisioterapia (modelo 3)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(3, 'Queixa', 'textarea', 'Queixa principal / região afetada', NULL, NULL, 1, 1),
(3, 'Queixa', 'escala', 'Intensidade da dor — EVA (0–10)', '0 = sem dor · 10 = pior dor imaginável', NULL, 1, 2),
(3, 'Queixa', 'select', 'Caráter da dor', NULL, '["Contínua","Intermitente","Em pontada","Queimação","Latejante"]', 0, 3),
(3, 'Funcional', 'checkbox', 'Limitação de amplitude de movimento', NULL, NULL, 0, 10),
(3, 'Funcional', 'checkbox', 'Alteração postural', NULL, NULL, 0, 11),
(3, 'Funcional', 'checkbox', 'Fraqueza muscular', NULL, NULL, 0, 12),
(3, 'Funcional', 'checkbox', 'Edema / inflamação', NULL, NULL, 0, 13),
(3, 'Histórico', 'textarea', 'Cirurgias / traumas ortopédicos', NULL, NULL, 0, 20),
(3, 'Histórico', 'textarea', 'Tratamentos fisioterapêuticos prévios', NULL, NULL, 0, 21),
(3, 'Objetivos', 'textarea', 'Objetivo do paciente com a reabilitação', NULL, NULL, 0, 30);

-- Campos: Nutrição (modelo 4)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(4, 'Objetivo', 'select', 'Objetivo principal', NULL, '["Emagrecimento","Ganho de massa","Reeducação alimentar","Patologia específica","Performance"]', 1, 1),
(4, 'Hábitos', 'textarea', 'Recordatório alimentar (24h)', 'Descreva as refeições do último dia típico...', NULL, 1, 10),
(4, 'Hábitos', 'numero', 'Refeições por dia (aprox.)', NULL, NULL, 0, 11),
(4, 'Hábitos', 'select', 'Consumo de água', NULL, '["<1L","1–2L",">2L"]', 0, 12),
(4, 'Restrições', 'checkbox', 'Alergia alimentar', NULL, NULL, 0, 20),
(4, 'Restrições', 'checkbox', 'Intolerância à lactose', NULL, NULL, 0, 21),
(4, 'Restrições', 'checkbox', 'Doença celíaca / gluten', NULL, NULL, 0, 22),
(4, 'Restrições', 'textarea', 'Restrições / aversões alimentares', NULL, NULL, 0, 23),
(4, 'Clínico', 'texto', 'Peso atual (kg)', NULL, NULL, 0, 30),
(4, 'Clínico', 'texto', 'Altura (cm)', NULL, NULL, 0, 31),
(4, 'Clínico', 'textarea', 'Patologias / medicações relevantes', NULL, NULL, 0, 32);

-- Campos: Odontologia (modelo 5)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(5, 'Queixa', 'textarea', 'Queixa principal oral', 'Dor, sangramento, estética, prótese...', NULL, 1, 1),
(5, 'Higiene', 'select', 'Frequência de escovação', NULL, '["1x/dia","2x/dia","3x ou mais"]', 0, 10),
(5, 'Higiene', 'checkbox', 'Uso de fio dental regularmente', NULL, NULL, 0, 11),
(5, 'Higiene', 'checkbox', 'Sangramento gengival', NULL, NULL, 0, 12),
(5, 'Antecedentes', 'checkbox', 'Alergia a anestésico local', NULL, NULL, 0, 20),
(5, 'Antecedentes', 'checkbox', 'Uso de anticoagulante', NULL, NULL, 0, 21),
(5, 'Antecedentes', 'checkbox', 'Diabetes', NULL, NULL, 0, 22),
(5, 'Antecedentes', 'checkbox', 'Hipertensão', NULL, NULL, 0, 23),
(5, 'Antecedentes', 'textarea', 'Cirurgias / tratamentos odontológicos prévios', NULL, NULL, 0, 24),
(5, 'Observações', 'textarea', 'Observações clínicas', NULL, NULL, 0, 30);

-- Campos: Terapeuta (6)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(6, 'Queixa e objetivos', 'textarea', 'Queixa / motivo da busca', NULL, NULL, 1, 1),
(6, 'Queixa e objetivos', 'textarea', 'Objetivos com o processo terapêutico', NULL, NULL, 1, 2),
(6, 'Histórico', 'textarea', 'Histórico emocional / eventos relevantes', NULL, NULL, 0, 10),
(6, 'Histórico', 'select', 'Já realizou terapia antes?', NULL, '["Não","Sim, breve","Sim, prolongada"]', 0, 11),
(6, 'Estado atual', 'escala', 'Nível de estresse (0–10)', NULL, NULL, 0, 20),
(6, 'Estado atual', 'select', 'Qualidade do sono', NULL, '["Boa","Regular","Ruim"]', 0, 21),
(6, 'Estado atual', 'checkbox', 'Uso de medicação psicoativa', NULL, NULL, 0, 22),
(6, 'Hábitos', 'textarea', 'Hábitos de vida / rotina', NULL, NULL, 0, 30),
(6, 'Observações', 'textarea', 'Observações do terapeuta', NULL, NULL, 0, 40);

-- Campos: Esteticista (7)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(7, 'Queixa', 'textarea', 'Queixa estética principal', 'Acne, manchas, flacidez, pelos...', NULL, 1, 1),
(7, 'Queixa', 'select', 'Área de interesse', NULL, '["Rosto","Corpo","Capilar","Mãos/Pés","Múltiplas"]', 0, 2),
(7, 'Pele e histórico', 'select', 'Tipo de pele', NULL, '["Oleosa","Seca","Mista","Sensível","Normal"]', 0, 10),
(7, 'Pele e histórico', 'checkbox', 'Alergia a cosméticos / ativos', NULL, NULL, 0, 11),
(7, 'Pele e histórico', 'checkbox', 'Uso de ácidos / retinoides', NULL, NULL, 0, 12),
(7, 'Pele e histórico', 'checkbox', 'Gestante ou lactante', NULL, NULL, 0, 13),
(7, 'Pele e histórico', 'textarea', 'Procedimentos estéticos prévios', NULL, NULL, 0, 14),
(7, 'Contraindicações', 'checkbox', 'Herpes ativo / lesões abertas', NULL, NULL, 0, 20),
(7, 'Contraindicações', 'checkbox', 'Uso de isotretinoína (últimos 6 meses)', NULL, NULL, 0, 21),
(7, 'Objetivo', 'textarea', 'Expectativa com o tratamento', NULL, NULL, 0, 30);

-- Campos: Fonoaudiólogo (8)
INSERT IGNORE INTO modelos_anamnese_campos (modelo_id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem) VALUES
(8, 'Queixa', 'textarea', 'Queixa principal (fala, voz, deglutição, audição)', NULL, NULL, 1, 1),
(8, 'Queixa', 'select', 'Área predominante', NULL, '["Linguagem","Fala","Voz","Deglutição","Audição","Motricidade orofacial"]', 0, 2),
(8, 'Histórico', 'textarea', 'Início e evolução do problema', NULL, NULL, 1, 10),
(8, 'Histórico', 'checkbox', 'Atraso de desenvolvimento de linguagem', NULL, NULL, 0, 11),
(8, 'Histórico', 'checkbox', 'Otites de repetição / perda auditiva', NULL, NULL, 0, 12),
(8, 'Histórico', 'checkbox', 'Cirurgias de cabeça/pescoço', NULL, NULL, 0, 13),
(8, 'Avaliação funcional', 'select', 'Inteligibilidade da fala', NULL, '["Boa","Reduzida","Muito reduzida","Não se aplica"]', 0, 20),
(8, 'Avaliação funcional', 'select', 'Deglutição', NULL, '["Normal","Engasgos ocasionais","Disfagia","Não avaliado"]', 0, 21),
(8, 'Contexto', 'textarea', 'Ambiente / demanda escolar ou profissional', NULL, NULL, 0, 30),
(8, 'Observações', 'textarea', 'Observações fonoaudiológicas', NULL, NULL, 0, 40);
