# Usa imagem oficial do Node
FROM node:18

# Cria o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência do backend
COPY backend/package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o conteúdo da pasta backend para dentro do diretório /app/backend
# Isso mantém a estrutura organizada que você queria
COPY backend/ . 

# Expõe a porta 3000 (porta interna do container)
EXPOSE 3000

# Comando para iniciar o app
# Ajustado para o caminho correto dentro do container
CMD ["node", "server.js"]