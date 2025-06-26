# Usa imagem oficial do Node
FROM node:18

# Cria o diretório de trabalho dentro do container
WORKDIR /app

# Copia package.json e instala dependências
COPY backend/package*.json ./
RUN npm install

# Copia todo o backend
COPY backend/ .

# Expõe a porta
EXPOSE 3000

# Comando para iniciar o app
CMD ["node", "server.js"]
