#!/bin/bash

# Configurações
DB_CONTAINER="sistema_limpeza-db-1"
APP_CONTAINER="sistema_limpeza-app-1"
PMA_CONTAINER="sistema_limpeza-phpmyadmin-1"
DB_NAME="terapia_system"
BACKUP_FILE="backup_limpeza_dev.sql" # Este arquivo será criado/sobrescrito automaticamente

max_tentativas=3

# Função de Backup (Cria o dump do estado ATUAL do banco)
fazer_backup() {
    docker exec $DB_CONTAINER mysqldump -u root -proot --single-transaction --routines --triggers --events $DB_NAME > $BACKUP_FILE
    [ -s "$BACKUP_FILE" ]
}

# Função de Checagem
check_status() {
    [ "$(docker inspect -f '{{.State.Running}}' $DB_CONTAINER 2>/dev/null)" == "true" ] && \
    [ "$(docker inspect -f '{{.State.Running}}' $APP_CONTAINER 2>/dev/null)" == "true" ] && \
    [ "$(docker inspect -f '{{.State.Running}}' $PMA_CONTAINER 2>/dev/null)" == "true" ]
}

echo "--- Iniciando processo de reset seguro ---"

# 1. Backup do estado atual
if ! fazer_backup; then
    echo "ERRO: Backup falhou. Abortando."
    exit 1
fi

# 2. Reset e Subida dos containers
tentativas=0
sucesso=false
while [ $tentativas -lt $max_tentativas ]; do
    tentativas=$((tentativas + 1))
    echo ">>> Tentativa $tentativas: Reiniciando serviços..."
    
    docker-compose down -v
    docker-compose up -d --build

    sleep 15
    if check_status; then
        sucesso=true
        break
    fi
done

if [ "$sucesso" = false ]; then echo "❌ Erro crítico."; exit 1; fi

# 3. Esperar o banco responder
until docker exec $DB_CONTAINER mysqladmin ping -u root -proot &> /dev/null; do sleep 2; done

# 4. Restauração Segura (Limpa o banco e importa o backup feito no passo 1)
echo "Restaurando dados..."
docker exec -i $DB_CONTAINER mysql -u root -proot -e "SET FOREIGN_KEY_CHECKS=0; DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME; SET FOREIGN_KEY_CHECKS=1;"
cat $BACKUP_FILE | docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME

# 5. Seed do Administrador
echo "Garantindo acesso do Administrador..."
docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME <<EOF
INSERT IGNORE INTO usuarios (id, clinica_id, nome, email, senha, cargo, criado_em) 
VALUES (2, NULL, 'Administrador MedLM', 'admin@medlm.com', 'mariarosa', 'dono', NOW());
EOF

echo "✅ SUCESSO: O ambiente foi resetado e seus dados estão preservados!"