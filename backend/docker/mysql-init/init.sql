CREATE DATABASE IF NOT EXISTS terapia_system;
USE terapia_system;

-- 1. CLINICAS (O "Pai" de tudo, tem que vir primeiro)
CREATE TABLE IF NOT EXISTS clinicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_clinica VARCHAR(100) NOT NULL,
  dono_nome VARCHAR(100) NOT NULL,
  email_master VARCHAR(100) NOT NULL UNIQUE,
  senha_master VARCHAR(255) NOT NULL,
  limite_membros INT DEFAULT 3,
  plano ENUM('trial', 'premium', 'enterprise') DEFAULT 'trial',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. USUARIOS (Agora pode apontar para clinicas)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    cargo ENUM('dono', 'administrador', 'recepcao', 'terapeuta') DEFAULT 'terapeuta',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. PACIENTES
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
  -- Aqui aceita a frase "Consulta Paga OK" perfeitamente
  status_pagamento VARCHAR(20) DEFAULT 'pendente',
  altura DECIMAL(3,2),
  condicoes_preexistentes TEXT,
  foto_perfil VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_paciente_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. AGENDAMENTOS (Removida a FK de membros_equipe e ajustada para usuarios)
CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL, -- Mudamos de membro_id para usuario_id
  data_agendamento DATETIME NOT NULL,
  status_agendamento ENUM('aguardando_sinal', 'confirmado', 'cancelado', 'finalizado') DEFAULT 'aguardando_sinal',
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
  CONSTRAINT fk_agend_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_agend_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. FINANCEIRO (Atualizada com link e gateway)
CREATE TABLE IF NOT EXISTS financeiro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  gateway_id VARCHAR(255) NULL, -- NOVO: Para integrar com Mercado Pago/Asaas
  paciente_id INT NOT NULL,
  agendamento_id INT NULL,
  tipo ENUM('receita', 'despesa') NOT NULL,
  descricao VARCHAR(255),
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE NULL,
  status_pagamento ENUM('aberto', 'pago', 'atrasado', 'estornado', 'cancelado') DEFAULT 'aberto',
  metodo_pagamento ENUM('pix', 'cartao', 'dinheiro', 'boleto'),
  link_pagamento TEXT NULL, -- NOVO: Para salvar o link gerado
  CONSTRAINT fk_fin_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. Anexos
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



--
-- INSERTS DE TESTE (Corrigidos para a nova estrutura)
-- Primeiro criamos a clinica
INSERT IGNORE INTO clinicas (id, nome_clinica, dono_nome, email_master, senha_master)
VALUES (1, 'Clínica Experimental', 'Leandro Marques', 'admin@sistema.com', '123456');

-- Depois o usuário dono vinculado à clinica 1
INSERT IGNORE INTO usuarios (clinica_id, nome, email, senha, cargo)
VALUES (1, 'Leandro Marques', 'leandro@teste.com', '123456', 'dono');