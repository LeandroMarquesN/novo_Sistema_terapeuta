CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;

-- Tabela de Pacientes (com nova coluna para foto de perfil)
CREATE TABLE IF NOT EXISTS pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  telefone VARCHAR(20),
  data_nascimento DATE,
  historico TEXT,
  foto_perfil VARCHAR(255), -- Nova coluna para o caminho da foto de perfil do paciente
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Agendamentos (com colunas email e telefone, e sem anexo singular)
CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  nome VARCHAR(100), -- Mantido como snapshot do nome no momento do agendamento
  data_agendamento DATETIME NOT NULL,
  tipo_terapia VARCHAR(100),
  observacoes TEXT,
  status_pagamento ENUM('pendente', 'pago') DEFAULT 'pendente',
  peso DECIMAL(5, 2), -- Mantido como snapshot
  altura DECIMAL(4, 2), -- Mantido como snapshot
  data_nascimento DATE, -- Mantido como snapshot
  idade INT, -- Mantido como snapshot
  tipo_sanguineo VARCHAR(5), -- Mantido como snapshot
  motivo_consulta TEXT,
  origem_indicacao VARCHAR(100),
  condicoes TEXT,
  email VARCHAR(100),    -- Nova coluna para email do paciente no agendamento
  telefone VARCHAR(20),  -- Nova coluna para telefone do paciente no agendamento
  -- Removida a coluna 'anexo' singular, agora substituída pela tabela 'anexos'
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  descricao TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);


-- Tabela de Testes Energéticos (mantida como está)
CREATE TABLE IF NOT EXISTS testes_energeticos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  aurimetro TEXT,
  pendulo TEXT,
  bdort TEXT,
  observacoes TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Anexos (Nova tabela para gerenciar múltiplos arquivos por agendamento)
CREATE TABLE IF NOT EXISTS anexos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agendamento_id INT NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  caminho_servidor VARCHAR(255) NOT NULL, -- Caminho do arquivo no servidor (ex: uploads/12345-exame.pdf)
  mime_type VARCHAR(100), -- Tipo MIME do arquivo (ex: image/jpeg, application/pdf)
  tamanho_bytes BIGINT, -- Tamanho do arquivo em bytes
  data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
);

-- Tabela de Usuários (mantida como está)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  senha VARCHAR(100) NOT NULL
);

<<<<<<< HEAD
-- Nova Tabela para Exames Processados IA, vinculada a agendamentos
CREATE TABLE IF NOT EXISTS exames (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agendamento_id INT NOT NULL,
  tipo_exame VARCHAR(255) NOT NULL,
  resultados JSON,
  diagnostico TEXT,
  raw_text TEXT,
  data_processamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
);
=======
>>>>>>> 3959620b0900f06c3eea4d8f921ebede1266b5c5
-- Inserindo terapeuta padrão (mantido como está)
INSERT IGNORE INTO usuarios (nome, senha)
VALUES ('karla', 'leandro');