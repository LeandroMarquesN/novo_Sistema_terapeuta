# 💻 Sistema Terapeuta

Sistema web completo para gestão de pacientes e agendamentos de uma terapeuta integrativa especializada em:

- Terapia Clark  
- Ozonoterapia  
- Ortomolecular  
- Biofísica  
- Microscopia de Campo Escuro

---

## 🧠 Objetivo

Digitalizar e facilitar o gerenciamento clínico com foco em:

- Cadastro e histórico dos pacientes  
- Agendamentos com confirmação por e-mail  
- Notificações de retorno automático (ex: 3 meses depois)  
- Dashboard administrativo para terapeuta  
- Pagamento de sinal via gateway antes de confirmar agendamento  
- Redução de arquivos físicos (digitalização de prontuários)

---

## ⚙️ Tecnologias Utilizadas

### 🧩 Frontend

- HTML5  
- CSS3  
- Bootstrap 5  
- JavaScript Vanilla  
- Responsivo (mobile-first)

### 🛠 Backend

- Node.js  
- Express.js  
- MySQL (containerizado com Docker)  
- Nodemailer (envio de e-mails)  
- API RESTful

### 📦 DevOps

- Docker  
- Docker Compose  
- .env (variáveis de ambiente)  
- Git e GitHub

---

## 🗂 Estrutura de Pastas

```
sistema-Terapeuta/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── docker/
│   │   └── mysql-init/init.sql
│   ├── .env
│   ├── Dockerfile
│   └── server.js
├── frontend/
│   ├── pages/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   └── agendamento.html
│   └── assets/
│       ├── css/
│       └── js/
├── docker-compose.yml
└── README.md
```

---

## 🚀 Como rodar localmente com Docker

1. Clone o repositório:
```bash
git clone https://github.com/LeandroMarquesN/sistema_terapeuta.git
cd sistema_terapeuta
```

2. Rode os containers com Docker:
```bash
docker-compose up --build
```

3. Acesse a aplicação:

- Frontend: http://localhost:3000  
- Banco de dados: MySQL rodando na porta `3306`

---

## 📬 Funcionalidades futuras

- Integração com API de pagamento (SAAP ou similar)  
- Sistema de login com autenticação segura  
- CRUD completo para paciente, agendamento, atendimento e testes  
- Relatórios PDF  
- Prontuário digital  
- Histórico clínico completo por paciente  

---

## 👨‍💻 Desenvolvedor

Leandro Marques  
[GitHub](https://github.com/LeandroMarquesN) | [Instagram @marquestechh](https://instagram.com/marquestechh)

---

## 📝 Licença

Este projeto está licenciado sob a [MIT License](LICENSE)