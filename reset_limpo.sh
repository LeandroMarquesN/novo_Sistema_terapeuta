#!/bin/bash

echo "--- ⚠️ ATENÇÃO: Iniciando destruição do ambiente ---"
read -p "Você já fez o backup? (s/n) " confirm
if [[ $confirm == [sS] ]]; then
    echo "Limpando e recriando..."
    docker-compose down -v
    docker-compose up -d --build
    echo "✅ Ambiente limpo e recriado com sucesso."
else
    echo "Abortado pelo usuário. Faça o backup antes!"
fi
