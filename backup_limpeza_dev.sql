-- MySQL dump 10.13  Distrib 8.4.9, for Linux (x86_64)
--
-- Host: localhost    Database: terapia_system
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `terapia_system`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `terapia_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `terapia_system`;

--
-- Table structure for table `agendamentos`
--

DROP TABLE IF EXISTS `agendamentos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agendamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `paciente_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `data_agendamento` datetime NOT NULL,
  `status_agendamento` enum('aguardando_sinal','confirmado','cancelado','finalizado') DEFAULT 'aguardando_sinal',
  `nome` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `genero` varchar(20) DEFAULT NULL,
  `tipo_terapia` varchar(100) DEFAULT NULL,
  `motivo_consulta` text,
  `origem_indicacao` varchar(100) DEFAULT NULL,
  `peso` decimal(5,2) DEFAULT NULL,
  `altura` decimal(3,2) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `idade` int DEFAULT NULL,
  `tipo_sanguineo` varchar(5) DEFAULT NULL,
  `condicoes` text,
  PRIMARY KEY (`id`),
  KEY `fk_agend_clinica` (`clinica_id`),
  KEY `fk_agend_paciente` (`paciente_id`),
  KEY `fk_agend_usuario` (`usuario_id`),
  CONSTRAINT `fk_agend_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agend_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agend_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agendamentos`
--

LOCK TABLES `agendamentos` WRITE;
/*!40000 ALTER TABLE `agendamentos` DISABLE KEYS */;
/*!40000 ALTER TABLE `agendamentos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anexos`
--

DROP TABLE IF EXISTS `anexos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anexos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `paciente_id` int NOT NULL,
  `agendamento_id` int NOT NULL,
  `nome_original` varchar(255) DEFAULT NULL,
  `caminho_servidor` varchar(255) DEFAULT NULL,
  `mime_type` varchar(50) DEFAULT NULL,
  `tamanho_bytes` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_anexo_clinica` (`clinica_id`),
  KEY `fk_anexo_paciente` (`paciente_id`),
  KEY `fk_anexo_agendamento` (`agendamento_id`),
  CONSTRAINT `fk_anexo_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_anexo_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_anexo_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anexos`
--

LOCK TABLES `anexos` WRITE;
/*!40000 ALTER TABLE `anexos` DISABLE KEYS */;
/*!40000 ALTER TABLE `anexos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clinica_configuracoes`
--

DROP TABLE IF EXISTS `clinica_configuracoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinica_configuracoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `horario_abertura` time DEFAULT '08:00:00',
  `horario_fechamento` time DEFAULT '18:00:00',
  `duracao_atendimento` int DEFAULT '30',
  `valor_sinal` decimal(10,2) DEFAULT '0.00',
  `dias_semana` varchar(50) DEFAULT '1,2,3,4,5',
  PRIMARY KEY (`id`),
  KEY `fk_config_clinica` (`clinica_id`),
  CONSTRAINT `fk_config_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinica_configuracoes`
--

LOCK TABLES `clinica_configuracoes` WRITE;
/*!40000 ALTER TABLE `clinica_configuracoes` DISABLE KEYS */;
/*!40000 ALTER TABLE `clinica_configuracoes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clinica_features`
--

DROP TABLE IF EXISTS `clinica_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinica_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `feature_id` int NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `fk_clinica_feat_clinica` (`clinica_id`),
  KEY `fk_clinica_feat_feature` (`feature_id`),
  CONSTRAINT `fk_clinica_feat_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clinica_feat_feature` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinica_features`
--

LOCK TABLES `clinica_features` WRITE;
/*!40000 ALTER TABLE `clinica_features` DISABLE KEYS */;
/*!40000 ALTER TABLE `clinica_features` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clinicas`
--

DROP TABLE IF EXISTS `clinicas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinicas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_clinica` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `dono_nome` varchar(100) NOT NULL,
  `telefone_clinica` varchar(20) NOT NULL,
  `telefone_dono` varchar(20) NOT NULL,
  `email_master` varchar(100) NOT NULL,
  `senha_master` varchar(255) NOT NULL,
  `plano_id` int NOT NULL,
  `valor_atual` decimal(10,2) DEFAULT '69.90',
  `status` enum('ativo','inadimplente','suspenso','cancelado') DEFAULT 'ativo',
  `data_cadastro` date DEFAULT (curdate()),
  `data_expiracao` date NOT NULL,
  `data_cancelamento` date DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `email_master` (`email_master`),
  KEY `fk_clinica_plano` (`plano_id`),
  CONSTRAINT `fk_clinica_plano` FOREIGN KEY (`plano_id`) REFERENCES `planos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinicas`
--

LOCK TABLES `clinicas` WRITE;
/*!40000 ALTER TABLE `clinicas` DISABLE KEYS */;
INSERT INTO `clinicas` VALUES (1,'Clinica Evolucao Estoica','clinica-evolucao-estoica','Leandro Marques','(11) 97016-6621','(11) 97016-6621','leandrommarquess.n@gmail.com','mariarosa',1,69.90,'ativo','2026-06-02','2026-07-02',NULL,'2026-06-02 16:27:13');
/*!40000 ALTER TABLE `clinicas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `features`
--

DROP TABLE IF EXISTS `features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_tecnico` varchar(50) NOT NULL,
  `descricao` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome_tecnico` (`nome_tecnico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `features`
--

LOCK TABLES `features` WRITE;
/*!40000 ALTER TABLE `features` DISABLE KEYS */;
/*!40000 ALTER TABLE `features` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `financeiro`
--

DROP TABLE IF EXISTS `financeiro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financeiro` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `gateway_id` varchar(255) DEFAULT NULL,
  `paciente_id` int NOT NULL,
  `agendamento_id` int DEFAULT NULL,
  `tipo` enum('receita','despesa') NOT NULL DEFAULT 'receita',
  `categoria` varchar(100) NOT NULL DEFAULT 'Consulta',
  `descricao` varchar(255) NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `data_vencimento` date NOT NULL,
  `data_pagamento` date DEFAULT NULL,
  `status_pagamento` enum('aberto','pago','atrasado','estornado','cancelado') DEFAULT 'aberto',
  `metodo_pagamento` enum('pix','cartao','dinheiro','boleto') DEFAULT NULL,
  `observacoes` text,
  `link_pagamento` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_fin_clinica` (`clinica_id`),
  KEY `fk_fin_paciente` (`paciente_id`),
  KEY `fk_fin_agendamento` (`agendamento_id`),
  KEY `fk_fin_usuario` (`usuario_id`),
  CONSTRAINT `fk_fin_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fin_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fin_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fin_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financeiro`
--

LOCK TABLES `financeiro` WRITE;
/*!40000 ALTER TABLE `financeiro` DISABLE KEYS */;
/*!40000 ALTER TABLE `financeiro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `financeiro_despesas`
--

DROP TABLE IF EXISTS `financeiro_despesas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financeiro_despesas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `descricao` varchar(255) NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `categoria` enum('marketing','fixa','variavel') NOT NULL,
  `data_vencimento` date NOT NULL,
  `status_pagamento` enum('aberto','pago') DEFAULT 'aberto',
  PRIMARY KEY (`id`),
  KEY `fk_despesa_clinica` (`clinica_id`),
  CONSTRAINT `fk_despesa_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financeiro_despesas`
--

LOCK TABLES `financeiro_despesas` WRITE;
/*!40000 ALTER TABLE `financeiro_despesas` DISABLE KEYS */;
/*!40000 ALTER TABLE `financeiro_despesas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logs_auditoria`
--

DROP TABLE IF EXISTS `logs_auditoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logs_auditoria` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `prontuario_id` int NOT NULL,
  `acao` varchar(50) NOT NULL,
  `data_acesso` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_log_usuario` (`usuario_id`),
  KEY `fk_log_prontuario` (`prontuario_id`),
  CONSTRAINT `fk_log_prontuario` FOREIGN KEY (`prontuario_id`) REFERENCES `prontuarios` (`id`),
  CONSTRAINT `fk_log_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logs_auditoria`
--

LOCK TABLES `logs_auditoria` WRITE;
/*!40000 ALTER TABLE `logs_auditoria` DISABLE KEYS */;
/*!40000 ALTER TABLE `logs_auditoria` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pacientes`
--

DROP TABLE IF EXISTS `pacientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pacientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `idade` int DEFAULT NULL,
  `tipo_sanguineo` varchar(5) DEFAULT NULL,
  `peso` decimal(5,2) DEFAULT NULL,
  `genero` varchar(20) DEFAULT NULL,
  `status_pagamento` varchar(20) DEFAULT 'pendente',
  `origem` enum('portal','manual','indicacao') DEFAULT 'manual',
  `altura` decimal(3,2) DEFAULT NULL,
  `condicoes_preexistentes` text,
  `foto_perfil` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_paciente_clinica` (`clinica_id`),
  CONSTRAINT `fk_paciente_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pacientes`
--

LOCK TABLES `pacientes` WRITE;
/*!40000 ALTER TABLE `pacientes` DISABLE KEYS */;
/*!40000 ALTER TABLE `pacientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plano_features`
--

DROP TABLE IF EXISTS `plano_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plano_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plano_id` int NOT NULL,
  `feature_id` int NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `fk_plano_feat_plano` (`plano_id`),
  KEY `fk_plano_feat_feature` (`feature_id`),
  CONSTRAINT `fk_plano_feat_feature` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plano_feat_plano` FOREIGN KEY (`plano_id`) REFERENCES `planos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plano_features`
--

LOCK TABLES `plano_features` WRITE;
/*!40000 ALTER TABLE `plano_features` DISABLE KEYS */;
/*!40000 ALTER TABLE `plano_features` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planos`
--

DROP TABLE IF EXISTS `planos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_plano` enum('trial','premium','enterprise') NOT NULL,
  `valor_base` decimal(10,2) NOT NULL,
  `valor_promocional` decimal(10,2) NOT NULL,
  `limite_membros` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planos`
--

LOCK TABLES `planos` WRITE;
/*!40000 ALTER TABLE `planos` DISABLE KEYS */;
INSERT INTO `planos` VALUES (1,'trial',109.90,69.90,3),(2,'premium',169.90,129.90,10),(3,'enterprise',209.90,159.90,999);
/*!40000 ALTER TABLE `planos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prontuarios`
--

DROP TABLE IF EXISTS `prontuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prontuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int NOT NULL,
  `paciente_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `agendamento_id` int DEFAULT NULL,
  `texto_evolucao` longtext NOT NULL,
  `diagnostico_cid` varchar(10) DEFAULT NULL,
  `status_prontuario` enum('rascunho','finalizado') DEFAULT 'rascunho',
  `data_atendimento` datetime NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prontuario_paciente` (`paciente_id`),
  KEY `idx_prontuario_clinica` (`clinica_id`),
  KEY `fk_pront_usuario` (`usuario_id`),
  KEY `fk_pront_agendamento` (`agendamento_id`),
  CONSTRAINT `fk_pront_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pront_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pront_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pront_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prontuarios`
--

LOCK TABLES `prontuarios` WRITE;
/*!40000 ALTER TABLE `prontuarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `prontuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinica_id` int DEFAULT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `cargo` enum('dono','admin','recepcao','terapeuta','medico','psicologo','fisioterapeuta','nutricionista','fonoaudiologo','profissional da saude') DEFAULT 'terapeuta',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuario_clinica` (`clinica_id`),
  CONSTRAINT `fk_usuario_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinicas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,1,'Leandro Marques','leandrommarquess.n@gmail.com','mariarosa','dono','2026-06-02 16:27:13');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-02 16:28:28
