# Dockerfile
FROM node:18

WORKDIR /app

# Copia o package.json e package-lock.json do backend
COPY backend/package*.json ./

# Instala as dependências do backend
RUN npm install

# Copia todo o conteúdo da pasta backend para o container
COPY backend/ .

EXPOSE 3000

# Executa o servidor
CMD ["node", "server.js"]
