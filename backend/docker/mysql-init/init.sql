CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;

-- Tabela de Pacientes
CREATE TABLE pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100),
  email VARCHAR(100),
  telefone VARCHAR(20),
  data_nascimento DATE,
  historico TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Agendamentos (agora totalmente consistente com o frontend)
CREATE TABLE agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  nome VARCHAR(100),
  data_agendamento DATETIME NOT NULL,
  tipo_terapia VARCHAR(100),
  observacoes TEXT,
  status_pagamento ENUM('pendente', 'pago') DEFAULT 'pendente',
  peso DECIMAL(5, 2),
  altura DECIMAL(4, 2),
  data_nascimento DATE,
  idade INT,
  tipo_sanguineo VARCHAR(5),
  motivo_consulta TEXT, -- Corresponde a 'motivo' do formulário
  origem_indicacao VARCHAR(100), -- Corresponde a 'origem' do formulário
  condicoes TEXT,
  anexo VARCHAR(255),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Atendimentos
CREATE TABLE atendimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  descricao TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);

-- Tabela de Testes Energéticos
CREATE TABLE testes_energeticos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT,
  data DATETIME,
  aurimetro TEXT,
  pendulo TEXT,
  bdort TEXT,
  observacoes TEXT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Usuários
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  senha VARCHAR(100) NOT NULL
);

-- Inserindo terapeuta padrão
INSERT INTO usuarios (nome, senha)
VALUES ('karla', 'leandro');