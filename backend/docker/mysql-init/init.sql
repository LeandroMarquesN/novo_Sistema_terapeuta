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
  paciente_id INT,
  data DATETIME,
  tipo_terapia VARCHAR(100),
  observacoes TEXT,
  status_pagamento ENUM('pendente', 'pago') DEFAULT 'pendente',
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
INSERT INTO usuarios (nome,senha)
VALUES ('Karla Marques', 'eu amo o leandro');
