<p align="center">
  <img width="90" src="./public/icon.svg" alt="Pillbox"/>
</p>
<h1 align="center">Pillbox</h1>
  <p align="center">Sistema pessoal de gerenciamento de medicamentos — controle de estoque, cotação de preços e acompanhamento remoto para cuidadores.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Prisma-5-2d3748?style=flat-square&logo=prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" />
</p>

---

## 📖 Sobre o Projeto

Minha mãe toma vários medicamentos contínuos. Eu faço as compras para ela, mas não moro junto — o que tornava difícil saber quando os remédios estavam acabando, acompanhar o estoque, comparar preços entre farmácias e manter um histórico de compras.

Esse sistema nasceu pra resolver exatamente isso: um painel completo para o **cuidador** e uma interface simplificada para o **dependente**, acessível pelo celular, para confirmar periodicamente como está a situação dos remédios.

---

## ✨ Funcionalidades

### 👨‍💼 Painel do Gestor

- **Remédios** — Cadastro completo com nome, princípio ativo, dosagem, forma farmacêutica, categoria (contínuo, eventual, controlado), regras de consumo e exigência de receita
- **Estoque** — Cálculo teórico automático com base no consumo diário configurado; ajuste manual a qualquer momento; histórico de confirmações e compras por medicamento
- **Compras** — Registro de compras com atualização automática do estoque; histórico completo com data, farmácia e valores
- **Cotação** — Comparação de preços entre múltiplas farmácias com links diretos de busca; badge de comparação com mediana histórica de preços (baseado em cotações e compras anteriores)
- **Relatório** — Gastos por período (mês/ano) detalhados por medicamento e farmácia, além de snapshot atual do estoque com previsão de próxima compra
- **Alertas** — Notificações automáticas: estoque crítico (≤10 dias), estoque baixo (≤30 dias), sem confirmação há 7+ dias e divergência de quantidade detectada

### 👩 Interface da Dependente (mobile-first, PWA)

- **Confirmação de estoque** — Fluxo simplificado: informa se o remédio está OK, ficando pouco ou acabando; opcionalmente informa a quantidade exata
- **Detecção de divergência** — Se a quantidade informada divergir mais de 1 unidade do estoque teórico, gera alerta automático para o gestor revisar
- **Situação dos remédios** — Tela de leitura com o status e dias restantes de cada medicamento
- **PWA** — Instalável no celular como app nativo (Android)

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions, Server Components) |
| Linguagem | TypeScript 5 |
| UI | Mantine v7 + Tabler Icons |
| ORM | Prisma 5 |
| Banco de dados | PostgreSQL 15 |
| Autenticação | NextAuth v5 (JWT, sessões de 90 dias) |
| Estilização | Tailwind CSS |
| Infraestrutura local | Docker + Docker Compose |

---

## 🏗️ Arquitetura

O projeto usa o **App Router do Next.js 15** com dois grupos de rotas isolados por perfil de usuário:

```
app/
├── (manager)/          # Painel do gestor (role: MANAGER)
│   └── manager/
│       ├── dashboard/
│       ├── medicines/
│       ├── stock/
│       ├── purchases/
│       ├── quotation/
│       ├── report/
│       ├── confirmations/
│       └── settings/
└── (mom)/              # Interface da dependente (role: DEPENDENT)
    └── mom/
        ├── home/       # Confirmação de estoque
        └── stock/      # Situação dos remédios
```

**Cálculo de estoque teórico** (calculado em tempo real no servidor, sem jobs):
```
estoque_atual = referenceQuantity − (unitsPerDose × dosesPerDay × diasDecorridos)
```

**Detecção de divergência:**
```
divergência = |quantidade_informada − estoque_teórico| > 1
```

**Comparação histórica de preços:**
Usa a mediana dos últimos registros (mínimo 2) para ser resistente a outliers como promoções ou compras de teste.

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js 20+
- Docker + Docker Compose

### 1. Clone o repositório

```bash
git clone https://github.com/lucaszarzur/pillbox.git
cd pillbox
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e preencha o `NEXTAUTH_SECRET` com uma string aleatória segura:

```bash
openssl rand -base64 32
```

### 3. Suba o banco de dados

```bash
docker-compose -f docker/docker-compose.yml up -d
```

### 4. Instale as dependências e aplique o schema

```bash
npm install
npx prisma db push
```

### 5. Crie os usuários iniciais

```bash
npx prisma db seed
```

### 6. Inicie a aplicação

```bash
npm run dev
```

Acesse em `http://localhost:3002`

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia em modo desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:studio` | Abre o Prisma Studio (visualizador do banco) |

---

## 👥 Perfis de usuário

| Perfil | Rota | Descrição |
|---|---|---|
| `MANAGER` | `/manager/*` | Controle total: remédios, estoque, compras, cotação, relatórios e alertas |
| `DEPENDENT` | `/mom/*` | Interface simplificada para confirmar estoque pelo celular |

O middleware do Next.js redireciona automaticamente cada perfil para a rota correta após o login.

---

## 📱 PWA

A interface da dependente é configurada como PWA — instalável como app no celular Android via navegador Chrome. Requer HTTPS em produção para o prompt de instalação aparecer automaticamente.

---

## Autor

**Lucas Zarzur**

[Website](https://lucaszarzur.dev/) · [LinkedIn](https://www.linkedin.com/in/lucas-zarzur/) · [GitHub](https://github.com/lucaszarzur)
