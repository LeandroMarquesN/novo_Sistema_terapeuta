#!/bin/bash

# Configurações
DB_CONTAINER="medlm_db"
DB_NAME="terapia_system"
DUMP_FILE="backup_limpeza_dev.sql"

echo "--- 🔄 Iniciando restauração do banco MedLM ---"

# Verifica se o arquivo existe
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ ERRO: O arquivo $DUMP_FILE não foi encontrado nesta pasta."
    exit 1
fi

echo "Preparando o banco de dados..."
# Garante que o banco exista antes de importar
docker exec -i $DB_CONTAINER mysql -h 127.0.0.1 -u root -proot -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

echo "Importando dados... (isso pode levar alguns segundos)"
# Executa a restauração forçando o host TCP
cat $DUMP_FILE | docker exec -i $DB_CONTAINER mysql -h 127.0.0.1 -u root -proot $DB_NAME

if [ $? -eq 0 ]; then
    echo "--- ✅ SUCESSO: Dados restaurados com sucesso! ---"
else
    echo "--- ❌ ERRO: Falha durante a restauração. Verifique o arquivo de dump. ---"
fi
