#!/bin/bash

DB_CONTAINER="medlm_db"
DB_NAME="terapia_system"
DUMP_FILE="backup_limpeza_dev.sql"

echo "--- 🔄 Iniciando restauração do banco MedLM ---"

# 1. Checagem de arquivo (validação estática)
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ ERRO: O arquivo $DUMP_FILE não foi encontrado."
    exit 1
fi

# 2. Checagem de prontidão (validação dinâmica)
# O loop só quebra se o comando ping retornar 0 (sucesso)
echo "Aguardando confirmação de prontidão do MySQL..."
n=0
until docker exec $DB_CONTAINER mysqladmin ping -h 127.0.0.1 -uroot -proot &> /dev/null; do
    echo "Ainda não está pronto... ($n tentativas)"
    n=$((n+1))
    if [ $n -gt 20 ]; then
        echo "❌ ERRO: O banco demorou demais para responder. Abortando."
        exit 1
    fi
    sleep 2
done

echo "✅ Banco pronto! Iniciando a restauração."

# 3. Execução da Restauração
# Só chegamos aqui se o banco respondeu ao ping
docker exec -i $DB_CONTAINER mysql -h 127.0.0.1 -u root -proot -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
cat $DUMP_FILE | docker exec -i $DB_CONTAINER mysql -h 127.0.0.1 -u root -proot $DB_NAME

if [ $? -eq 0 ]; then
    echo "--- ✅ SUCESSO: Dados restaurados! ---"
else
    echo "--- ❌ ERRO: Falha na importação. ---"
    exit 1
fi
