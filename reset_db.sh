#!/bin/bash

# Configurações
DB_CONTAINER="sistema_dev-db-1"
APP_CONTAINER="sistema_dev-app-1"
PMA_CONTAINER="sistema_dev-phpmyadmin-1"
DB_NAME="terapia_system"
BACKUP_FILE="backup_limpeza_dev.sql"

# Limite de tentativas
max_tentativas=3

# Função de Backup
fazer_backup() {
    docker exec $DB_CONTAINER mysqldump -u root -proot --single-transaction --databases $DB_NAME > $BACKUP_FILE
    [ -s "$BACKUP_FILE" ]
}

# Função de Checagem
check_status() {
    [ "$(docker inspect -f '{{.State.Running}}' $DB_CONTAINER 2>/dev/null)" == "true" ] && \
    [ "$(docker inspect -f '{{.State.Running}}' $APP_CONTAINER 2>/dev/null)" == "true" ] && \
    [ "$(docker inspect -f '{{.State.Running}}' $PMA_CONTAINER 2>/dev/null)" == "true" ]
}

echo "--- Iniciando processo de reset seguro (Máximo 3 tentativas) ---"

# 1. Backup
if ! fazer_backup; then
    echo "ERRO: Backup falhou. Abortando."
    exit 1
fi

# 2. Reset e Tentativas de Subida
tentativas=0
sucesso=false

while [ $tentativas -lt $max_tentativas ]; do
    tentativas=$((tentativas + 1))
    echo ">>> Tentativa $tentativas de $max_tentativas: Subindo serviços..."
    
    docker-compose down -v
    docker-compose up -d --build

    # Espera 15 segundos para os serviços estabilizarem
    sleep 15

    if check_status; then
        echo "✅ Todos os serviços estão rodando!"
        sucesso=true
        break
    else
        echo "⚠️ Falha na tentativa $tentativas: Nem todos os containers subiram."
    fi
done

# 3. Verificação Final de Sucesso
if [ "$sucesso" = false ]; then
    echo "❌ Erro crítico: Serviços não subiram após $max_tentativas tentativas. Verifique os logs com 'docker-compose logs'."
    exit 1
fi

# 4. Esperar o banco responder
echo "Aguardando banco de dados responder..."
until docker exec $DB_CONTAINER mysqladmin ping -u root -proot &> /dev/null; do
    sleep 2
done

# 5. Restauração
echo "Restaurando dados..."
docker exec -i $DB_CONTAINER mysql -u root -proot $DB_NAME < $BACKUP_FILE

echo "--------------------------------------------------------"
echo "✅ SUCESSO: O ambiente foi resetado e populado!"
echo "--------------------------------------------------------"
