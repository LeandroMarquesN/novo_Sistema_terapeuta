#!/bin/bash

# Cores para o terminal
VERDE='\033[0;32m'
AZUL='\033[0;34m'
AMARELO='\033[1;33m'
RESET='\033[0m'

clear
echo -e "${AZUL}=================================================${RESET}"
echo -e "${VERDE}      MED-LM : PAINEL DE CONTROLE DOCKER       ${RESET}"
echo -e "${AZUL}=================================================${RESET}"
echo " Escolha uma opção para seu querido servidor:"
echo ""
echo -e " 1) 👀 ${VERDE}Ver Logs${RESET} (logs -f app)"
echo -e " 2) 🚀 ${VERDE}Subir Sistema${RESET} (up --build -d)"
echo -e " 3) 🔄 ${AMARELO}Reiniciar App${RESET} (restart app)"
echo -e " 4) ⏹️  ${AMARELO}Parar Containers${RESET} (down)"
echo -e " 5) 🛑 ${AMARELO}Limpar TUDO${RESET} (down -v)"
echo -e " 6) 📋 ${AZUL}Status dos Processos${RESET} (docker ps)"
echo -e " 7) ❌ Sair"
echo ""
read -p " Digite o número e aperte Enter: " opcao

case $opcao in
    1) docker compose logs -f app ;;
    2) docker compose up --build -d ;;
    3) docker compose restart app ;;
    4) docker compose down ;;
    5) docker compose down -v ;;
    6) echo -e "\n${AZUL}--- Containers Ativos ---${RESET}" && docker ps && echo "" && read -p "Pressione Enter para voltar ao menu..." ;;
    7) exit ;;
    *) echo "Opção inválida, Leandro!" ;;
esac
