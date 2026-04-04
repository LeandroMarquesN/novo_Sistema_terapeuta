CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;

-- 1. CLINICAS
CREATE TABLE clinicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_clinica VARCHAR(100) NOT NULL,
  dono_nome VARCHAR(100) NOT NULL,
  email_master VARCHAR(100) NOT NULL UNIQUE,
  senha_master VARCHAR(255) NOT NULL,
  limite_membros INT DEFAULT 3,
  plano ENUM('trial', 'premium', 'enterprise') DEFAULT 'trial',
  valor_sinal_padrao DECIMAL(10,2) DEFAULT 0.00,
  chave_api_pagamento VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. MEMBROS
CREATE TABLE membros_equipe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  cargo ENUM('administrador', 'recepcao', 'terapeuta') DEFAULT 'terapeuta',
  CONSTRAINT fk_membros_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. PACIENTES
CREATE TABLE pacientes (
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
  altura DECIMAL(4,2),
  profissao VARCHAR(100),
  endereco VARCHAR(255),
  condicoes_preexistentes TEXT,
  historico_familiar TEXT,
  observacoes_gerais TEXT,
  foto_perfil VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pacientes_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. AGENDAMENTOS
CREATE TABLE agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  membro_id INT NOT NULL,
  nome VARCHAR(100),
  data_agendamento DATETIME NOT NULL,
  tipo_terapia VARCHAR(100),
  observacoes TEXT,
  peso DECIMAL(5,2),
  altura DECIMAL(4,2),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  motivo_consulta TEXT,
  origem_indicacao VARCHAR(100),
  condicoes TEXT,
  email VARCHAR(100),
  telefone VARCHAR(20),
  cpf VARCHAR(14),
  status_agendamento ENUM('aguardando_sinal', 'confirmado', 'cancelado', 'finalizado') DEFAULT 'aguardando_sinal',
  link_pagamento_sinal VARCHAR(255),
  valor_total_sessao DECIMAL(10,2) DEFAULT 0.00,
  valor_sinal_pago DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT fk_agend_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_membro FOREIGN KEY (membro_id) REFERENCES membros_equipe(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. ANEXOS
CREATE TABLE anexos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  caminho_servidor VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  tamanho_bytes BIGINT,
  data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_anexos_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexos_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexos_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. ATENDIMENTOS
CREATE TABLE atendimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NULL,
  membro_id INT NOT NULL,
  data_atendimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  queixa_principal TEXT,
  evolucao_clinica TEXT,
  prescricao_recomendacoes TEXT,
  testes_realizados TEXT,
  CONSTRAINT fk_atend_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_atend_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_atend_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON SET NULL,
  CONSTRAINT fk_atend_membro FOREIGN KEY (membro_id) REFERENCES membros_equipe(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. FINANCEIRO
CREATE TABLE financeiro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  agendamento_id INT NULL,
  tipo ENUM('receita', 'despesa') NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status ENUM('aberto', 'pago', 'atrasado') DEFAULT 'aberto',
  metodo_pagamento ENUM('pix', 'cartao', 'dinheiro'),
  descricao TEXT,
  CONSTRAINT fk_fin_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON SET NULL
) ENGINE=InnoDB;

-- 8. USUARIOS (ANTIGO)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  senha VARCHAR(100) NOT NULL
);

-- INSERTS INICIAIS
INSERT IGNORE INTO usuarios (nome, senha) VALUES ('karla', 'leandro');
INSERT IGNORE INTO clinicas (id, nome_clinica, dono_nome, email_master, senha_master, limite_membros) 
VALUES (1, 'Clínica de Teste', 'Admin Teste', 'teste@medlm.com', '123456', 3);
INSERT IGNORE INTO membros_equipe (id, clinica_id, nome, email, senha, cargo)
VALUES (1, 1, 'Dra. Karla', 'karla@teste.com', '123456', 'administrador');