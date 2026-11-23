# Bandeira Barber — Plataforma web de marcações com lembretes automáticos

Projeto de Engenharia Informática (ISLA — Instituto Politécnico de Gestão e Tecnologia, Gaia), ano letivo 2026/27.

| | |
| --- | --- |
| Dupla | João Mouta (a22409272) · Francisco Rocha (a22401621) |
| Orientador | Professor José Augusto Monteiro |
| Product Owner | Proprietário da Bandeira Barber |
| Fase atual | Planeamento — Sprint 1 (E1 a E4), a fechar a 29 de novembro de 2026 |
| Quadro Scrum | [PREENCHER: URL do GitHub Projects] |

## Onde está o quê

| Pasta | Conteúdo |
| --- | --- |
| [`docs/`](docs/README.md) | Documentos das entregas (índice dos documentos 1 a 28) |
| [`docs/relatorio/`](docs/relatorio/) | PDF do relatório entregue em cada entrega |
| [`docs/pesquisa/`](docs/pesquisa/) | Protocolo de pesquisa, registo da execução e lista de referências |
| [`docs/entregas/`](docs/entregas/) | Matrizes de literatura (doc. 7) e de soluções (doc. 8) |
| [`docs/prototipo/`](docs/prototipo/README.md) | O que é o protótipo v0 e como é tratado no projeto |
| `src/`, `db/`, `scripts/` | Código do protótipo v0 (iteração 0) |

## Sobre o código deste repositório

O código foi escrito em setembro de 2026, **antes do arranque formal do projeto** (2 de novembro de 2026), como protótipo exploratório.
Está marcado com a etiqueta [`v0-prototipo-exploratorio`](https://github.com/XicoRocha/bandeira-barber/tree/v0-prototipo-exploratorio).
Não é a especificação do produto: os requisitos são definidos nas entregas E5 a E7 a partir do Product Owner,
e o protótipo é depois comparado com eles (ver [`docs/prototipo/`](docs/prototipo/README.md)).
A partir da fase de planeamento, qualquer alteração ao código parte de um item do quadro.

---

## Protótipo v0 — Marcações

Web app de marcações para a barbearia. Tem duas partes:

- **Clientes** (`/`): escolhem o serviço, o barbeiro e a hora, e marcam só com nome + telemóvel. Recebem SMS/email de confirmação e um lembrete na véspera. Podem cancelar pelo link que recebem.
- **Gestão** (`/admin`): a agenda do dia, marcações feitas ao balcão, bloqueio de horas e férias, ficha de cada cliente com notas, estatísticas (faturação, ocupação, faltas, horas de maior procura, clientes a recuperar) e definições (serviços, preços, horários).

Stack: Next.js 16 + Postgres (Supabase) + Vercel. SMS via Twilio, email via Resend (ambos opcionais).

### Correr localmente

```bash
npm install
cp .env.example .env.local   # e editar os valores
npm run db:dev               # base de dados local (deixar a correr noutro terminal)
npm run db:setup             # cria tabelas, serviços, horários e a conta do gestor
npm run db:demo              # (opcional) 4 meses de dados fictícios para experimentar
npm run dev                  # http://localhost:3100  e  http://localhost:3100/admin
```

### Pôr online (grátis)

1. **Supabase** (supabase.com) → criar projeto (região: Europa) → *Connect* → copiar a connection string do **Transaction pooler** (porta 6543).
2. No computador, pôr essa string em `DATABASE_URL` no `.env.local`, apagar a linha `DATABASE_POOL_MAX` e correr `npm run db:setup`.
3. **Vercel** (vercel.com) → importar o repositório do GitHub → em *Environment Variables* colar as variáveis do `.env.example` (sem `DATABASE_POOL_MAX`), com `APP_URL` igual ao domínio final.
4. O cron dos lembretes (`vercel.json`) corre todos os dias às 17h UTC (18h em Lisboa no verão). A Vercel envia o `CRON_SECRET` automaticamente.

#### SMS (Twilio)
Criar conta → comprar/ativar um remetente → `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (um nome alfanumérico como `BandeiraBrb` funciona em Portugal). Custa cerca de 0,05 € por SMS. Sem estas variáveis, os SMS aparecem só nos logs.

#### Email (Resend)
Criar conta → verificar o domínio → `RESEND_API_KEY` e `EMAIL_FROM`. O plano grátis dá 3000 emails/mês.

### Coisas a confirmar com o barbeiro

- Duração de cada serviço (pus 30 / 45 / 20 min, é só editar em Definições)
- Horário real de cada um e a pausa de almoço (pus terça a sábado, 9:30–13:00 e 14:30–19:30)
- Nome do segundo barbeiro, morada, telefone e Instagram
- Regras: antecedência mínima (60 min), até quantos dias se pode marcar (30) e até quando se pode cancelar (2h antes)

### Estrutura

| Onde | O quê |
|---|---|
| `db/schema.sql` | Tabelas. A restrição `no_overlap` impede marcações sobrepostas, mesmo em simultâneo |
| `src/lib/availability.ts` | Cálculo dos horários livres |
| `src/lib/booking.ts` | Criar marcação (validação, cliente, “qualquer barbeiro”) |
| `src/lib/notify.ts` | Textos e envio de SMS/email |
| `src/lib/stats.ts` | Consultas das estatísticas |
| `src/app/marcar` | Fluxo de marcação do cliente |
| `src/app/m/[token]` | Página da marcação (ver, calendário, cancelar) |
| `src/app/admin` | Área de gestão |
