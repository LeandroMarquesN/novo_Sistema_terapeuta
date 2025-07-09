CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;
CREATE TABLE pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100),
  email VARCHAR(100),
  telefone VARCHAR(20),
  data_nascimento DATE,
  historico TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  data DATETIME NOT NULL,
  tipo_terapia VARCHAR(100),
  observacoes TEXT,
  status_pagamento ENUM('pendente', 'pago') DEFAULT 'pendente',
  -- Novos campos adicionados
  peso DECIMAL(5, 2),
  altura DECIMAL(4, 2),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  motivo_consulta TEXT,
  origem_indicacao VARCHAR(100),
  -- Condições de saúde (checkboxes)
  hipertensao BOOLEAN DEFAULT FALSE,
  diabetes BOOLEAN DEFAULT FALSE,
  resistencia_insulinica BOOLEAN DEFAULT FALSE,
  problemas_cardio BOOLEAN DEFAULT FALSE,
  neurologico BOOLEAN DEFAULT FALSE,
  dificuldade_hepatica BOOLEAN DEFAULT FALSE,
  problema_renal BOOLEAN DEFAULT FALSE,
  teia BOOLEAN DEFAULT FALSE,
  tdh BOOLEAN DEFAULT FALSE,
  amalgamas BOOLEAN DEFAULT FALSE,
  protese_dental BOOLEAN DEFAULT FALSE,
  canal_dental BOOLEAN DEFAULT FALSE,
  depressao BOOLEAN DEFAULT FALSE,
  outros_problemas TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);
CREATE TABLE atendimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  descricao TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);
CREATE TABLE testes_energeticos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  aurimetro TEXT,
  pendulo TEXT,
  bdort TEXT,
  observacoes TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  senha VARCHAR(100) NOT NULL
);
-- Inserindo terapeuta padrão
INSERT INTO usuarios (nome, senha)
VALUES ('karla', 'leandro');