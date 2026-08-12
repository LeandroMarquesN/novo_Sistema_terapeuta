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
(3, 'enterprise', 269.90, 89.90, 999);

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
  
  -- Novas colunas integradas
  gateway_id VARCHAR(255) NULL,

  tipo_plano ENUM('FUNDADOR', 'PADRAO') DEFAULT 'PADRAO',
  data_inicio_trial DATE NULL,
  asaas_customer_id VARCHAR(100) NULL,
  asaas_subscription_id VARCHAR(100) NULL,
  status_pagamento ENUM('trial', 'ativo', 'inadimplente', 'cancelado') DEFAULT 'trial',

  -- novas colunas
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


-- 4. TABELA DE USUÁRIOS (Atualizada com a nova gama de profissionais)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,

    -- 🔑 Novas colunas adicionadas para o "Esqueci minha senha"
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_expires DATETIME DEFAULT NULL,
    
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
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. PACIENTES (Versão Atualizada com Sistema de Tokens)
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
  altura DECIMAL(3,2),
  condicoes_preexistentes TEXT,
  foto_perfil VARCHAR(255),
  
  -- Novas colunas para o Portal do Paciente
  token_acesso VARCHAR(128) DEFAULT NULL,
  token_expiracao DATETIME DEFAULT NULL,
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índice para busca rápida de tokens
  INDEX idx_token_acesso (token_acesso),
  
  CONSTRAINT fk_paciente_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
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
  altura DECIMAL(3,2),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  condicoes TEXT,

  -- Coluna gerada: só tem valor se o agendamento estiver ATIVO (não cancelado)
  -- Cancelados viram NULL e não contam pra unicidade (NULL != NULL no MySQL)
  slot_ativo DATETIME GENERATED ALWAYS AS (
    CASE WHEN status_agendamento <> 'cancelado' THEN data_agendamento ELSE NULL END
  ) STORED,

  CONSTRAINT fk_agend_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,

  -- A trava real: impossível existir 2 registros ativos na mesma clínica + horário
  UNIQUE KEY uq_agend_clinica_horario_ativo (clinica_id, slot_ativo)
) ENGINE=InnoDB;

-- CONFIGURAÇÕES (Corrigida a vírgula do valor_sinal)
CREATE TABLE IF NOT EXISTS clinica_configuracoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  horario_abertura TIME DEFAULT '08:00:00',
  horario_fechamento TIME DEFAULT '18:00:00',
  duracao_atendimento INT DEFAULT 30,
  valor_sinal DECIMAL(10,2) DEFAULT 0.00,
  dias_semana VARCHAR(50) DEFAULT '1,2,3,4,5',
  periodos_fechados JSON DEFAULT NULL,
  CONSTRAINT fk_config_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. TABELAS DE FEATURE FLAGS (Funcionalidades)
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

-- 7. FINANCEIRO (Refatorado para Extrato Completo e Lançamentos Avulsos)
CREATE TABLE IF NOT EXISTS financeiro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  usuario_id INT NULL, -- Quem da equipe realizou/registrou o lançamento
  gateway_id VARCHAR(255) NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NULL, -- Fica NULL se for um gasto avulso (sem consulta atrelada)
  tipo ENUM('receita', 'despesa') NOT NULL DEFAULT 'receita',
  categoria VARCHAR(100) NOT NULL DEFAULT 'Consulta', -- Ex: 'Consulta', 'Material', 'Retorno', 'Multa'
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE NULL,
  status_pagamento ENUM('aberto', 'pago', 'atrasado', 'estornado', 'cancelado') DEFAULT 'aberto',
  metodo_pagamento ENUM('pix', 'cartao', 'dinheiro', 'boleto'),
  observacoes TEXT NULL, -- Para anotações e histórico do terapeuta
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

-- 10. PRONTUÁRIOS / EVOLUÇÕES CLÍNICAS (Padrão de Mercado & Segurança Jurídica)
CREATE TABLE IF NOT EXISTS prontuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,      -- O profissional logado que realizou o atendimento
  agendamento_id INT NULL,      -- Vincula à consulta da agenda (opcional, caso seja um atendimento avulso)

  texto_evolucao LONGTEXT NOT NULL, -- Conteúdo da sessão (suporta HTML do editor Rich Text)
  diagnostico_cid VARCHAR(10) NULL, -- Código CID-10/CID-11 se for aplicável

  status_prontuario ENUM('rascunho', 'finalizado') DEFAULT 'rascunho', -- Trava jurídica
  data_atendimento DATETIME NOT NULL, -- Data/Hora informada do atendimento
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- ÍNDICES DE PERFORMANCE (Agiliza a busca da timeline do paciente)
  INDEX idx_prontuario_paciente (paciente_id),
  INDEX idx_prontuario_clinica (clinica_id),

  -- TRAVAS DE INTEGRIDADE (Chaves Estrangeiras)
  CONSTRAINT fk_pront_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_pront_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 🛡️ [AUDITORIA] Módulo de Segurança e Rastreabilidade
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  prontuario_id INT NOT NULL,
  acao VARCHAR(50) NOT NULL,
  data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_log_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
) ENGINE=InnoDB;

-- INSERTS DE TESTE (Adicionado SLUG para não dar erro)
INSERT IGNORE INTO clinicas (id, nome_clinica, slug, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master, plano_id, data_expiracao)
VALUES (1, 'Clínica Experimental', 'clinica-experimental', 'Leandro Marques', '1199999999', '1188888888', 'admin@sistema.com', '123456', 1, '2026-12-31');

INSERT IGNORE INTO usuarios (clinica_id, nome, email, senha, cargo)
VALUES (1, 'Leandro Marques', 'leandro@teste.com', '123456', 'dono');

INSERT IGNORE INTO usuarios (clinica_id, nome, email, senha, cargo)
VALUES (NULL, 'Administrador MedLM', 'admin@medlm.com', 'mariarosa', 'dono');

-- 8. INSERTS DE CONFIGURAÇÃO
INSERT IGNORE INTO features (nome_tecnico, descricao) VALUES
('portal_paciente', 'Permite acesso ao portal de agendamento'),
('notificacao_whatsapp', 'Envio automático de lembretes'),
('relatorios_avancados', 'Dashboards financeiros completos');

-- 9. POPULANDO AS FEATURE FLAGS (Opcional, mas recomendado para testes)
-- Exemplo: Libera tudo para Enterprise, e apenas o básico para o Trial
INSERT IGNORE INTO plano_features (plano_id, feature_id, is_enabled) VALUES
-- TRIAL (Plano 1): Tem apenas portal_paciente
(1, 1, true), (1, 2, false), (1, 3, false),
-- PREMIUM (Plano 2): Tem portal e whatsapp
(2, 1, true), (2, 2, true), (2, 3, false),
-- ENTERPRISE (Plano 3): Tem tudo
(3, 1, true), (3, 2, true), (3, 3, true);