#!/bin/bash
DB_CONTAINER="medlm_db"
DB_NAME="terapia_system"
BACKUP_FILE="backup_limpeza_dev.sql"

echo "--- 💾 Criando Backup de Segurança ---"

# Tenta criar o backup
docker exec $DB_CONTAINER mysqldump -u root -proot --single-transaction --routines --triggers --events $DB_NAME > $BACKUP_FILE

# Verifica se o arquivo não ficou vazio
if [ -s "$BACKUP_FILE" ]; then
    echo "✅ Backup criado com sucesso: $BACKUP_FILE"
    echo "Agora você pode rodar o ./reset_limpo.sh com segurança."
else
    echo "❌ ERRO: O backup falhou ou o arquivo está vazio! NÃO rode o reset agora."
    exit 1
fi
