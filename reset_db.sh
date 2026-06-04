#!/bin/bash

# Configurações com nomes fixos (devem bater com o docker-compose.yml)
DB_CONTAINER="medlm_db"
APP_CONTAINER="medlm_app"
DB_NAME="terapia_system"
BACKUP_FILE="backup_limpeza_dev.sql"

echo "--- 🚀 Iniciando processo de reset seguro (MedLM) ---"

# 1. Backup com verificação de integridade
echo "Realizando backup do estado atual..."
docker exec $DB_CONTAINER mysqldump -u root -proot --single-transaction --routines --triggers --events $DB_NAME > $BACKUP_FILE

if [ ! -s "$BACKUP_FILE" ]; then
    echo "❌ ERRO: Backup falhou ou arquivo está vazio. Abortando para proteger dados!"
    exit 1
fi
echo "✅ Backup realizado com sucesso."

# 2. Reset dos Containers
echo "Destruindo e recriando containers..."
docker-compose down -v
docker-compose up -d --build

# 3. Esperar o MySQL estar realmente pronto
echo "Aguardando o serviço de banco de dados iniciar..."
until docker exec $DB_CONTAINER mysqladmin ping -u root -proot &> /dev/null; do
  echo "Ainda esperando o MySQL..."
  sleep 3
done
echo "✅ MySQL pronto para receber dados."

# 4. Restauração (Limpa e Importa)
echo "Restaurando dados a partir do backup..."
docker exec -i $DB_CONTAINER mysql -u root -proot -e "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME;"
cat $BACKUP_FILE | docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME

# AQUI ESTÁ A CORREÇÃO:
SEED_FILE="./mysql-init/seed.sql"
if [ -f "$SEED_FILE" ]; then
    echo "Aplicando dados de testes (seed) em $SEED_FILE..."
    cat "$SEED_FILE" | docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME
else
    echo "Aviso: Arquivo seed.sql não encontrado. Continuando..."
fi

# 5. Garantia do Acesso Admin
echo "Aplicando permissões de administrador..."
docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME <<EOF
INSERT IGNORE INTO usuarios (id, clinica_id, nome, email, senha, cargo, criado_em) 
VALUES (2, NULL, 'Administrador MedLM', 'admin@medlm.com', 'mariarosa', 'dono', NOW());
EOF

echo "--- ✅ SUCESSO TOTAL: Ambiente resetado com segurança! ---"