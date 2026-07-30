# Usa imagem oficial do Node
FROM node:18-alpine

# Cria o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência
COPY backend/package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o conteúdo da pasta backend para dentro da raiz /app
COPY backend/ . 

# COPIE A PASTA FRONTEND TAMBÉM (Essencial!)
COPY frontend/ ./frontend/

# Expõe a porta 3000
EXPOSE 3000

# O Docker vai rodar o server.js que agora está na raiz do WORKDIR (/app)
CMD ["node", "server.js"]