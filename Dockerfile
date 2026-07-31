# Usa imagem oficial do Node
FROM node:20-alpine

# Cria o diretório de trabalho dentro do container
WORKDIR /app/backend

# Copia os arquivos de dependência
COPY backend/package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o conteúdo da pasta backend para dentro da raiz /app/backend
COPY backend/ . 

# COPIE A PASTA FRONTEND TAMBÉM (Essencial!)
COPY frontend/ /app/frontend/

# Expõe a porta 3000
EXPOSE 3000

# O Docker vai rodar o server.js que está em /app/backend
CMD ["node", "server.js"]