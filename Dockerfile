# Usa uma imagem Node.js como base
ARG BUILD_ID
FROM node:18

# Define o diretório de trabalho no container
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json
COPY package*.json ./

# Instala as dependências Node.js
RUN npm install

# Copia todo o código da aplicação para o container
COPY . .

# Instala Python e pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Instala o spaCy e o modelo de linguagem pt_core_news_sm
# A instalação do modelo é feita diretamente da URL para evitar erros de distribuição
RUN pip3 install --break-system-packages spacy && \
    pip3 install --break-system-packages https://github.com/explosion/spacy-models/releases/download/pt_core_news_sm-3.7.0/pt_core_news_sm-3.7.0.tar.gz

# Expõe a porta que o app vai rodar
EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "node", "server.js" ]
