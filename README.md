# Bandeira Barber — Marcações

Web app de marcações para a barbearia. Tem duas partes:

- **Clientes** (`/`): escolhem o serviço, o barbeiro e a hora, e marcam só com nome + telemóvel. Recebem SMS/email de confirmação e um lembrete na véspera. Podem cancelar pelo link que recebem.
- **Gestão** (`/admin`): a agenda do dia, marcações feitas ao balcão, bloqueio de horas e férias, ficha de cada cliente com notas, estatísticas (faturação, ocupação, faltas, horas de maior procura, clientes a recuperar) e definições (serviços, preços, horários).

Stack: Next.js 16 + Postgres (Supabase) + Vercel. SMS via Twilio, email via Resend (ambos opcionais).

## Correr localmente

```bash
npm install
cp .env.example .env.local   # e editar os valores
npm run db:dev               # base de dados local (deixar a correr noutro terminal)
npm run db:setup             # cria tabelas, serviços, horários e a conta do gestor
npm run db:demo              # (opcional) 4 meses de dados fictícios para experimentar
npm run dev                  # http://localhost:3100  e  http://localhost:3100/admin
```

## Pôr online (grátis)

1. **Supabase** (supabase.com) → criar projeto (região: Europa) → *Connect* → copiar a connection string do **Transaction pooler** (porta 6543).
2. No computador, pôr essa string em `DATABASE_URL` no `.env.local`, apagar a linha `DATABASE_POOL_MAX` e correr `npm run db:setup`.
3. **Vercel** (vercel.com) → importar o repositório do GitHub → em *Environment Variables* colar as variáveis do `.env.example` (sem `DATABASE_POOL_MAX`), com `APP_URL` igual ao domínio final.
4. O cron dos lembretes (`vercel.json`) corre todos os dias às 17h UTC (18h em Lisboa no verão). A Vercel envia o `CRON_SECRET` automaticamente.

### SMS (Twilio)
Criar conta → comprar/ativar um remetente → `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (um nome alfanumérico como `BandeiraBrb` funciona em Portugal). Custa cerca de 0,05 € por SMS. Sem estas variáveis, os SMS aparecem só nos logs.

### Email (Resend)
Criar conta → verificar o domínio → `RESEND_API_KEY` e `EMAIL_FROM`. O plano grátis dá 3000 emails/mês.

## Coisas a confirmar com o barbeiro

- Duração de cada serviço (pus 30 / 45 / 20 min, é só editar em Definições)
- Horário real de cada um e a pausa de almoço (pus terça a sábado, 9:30–13:00 e 14:30–19:30)
- Nome do segundo barbeiro, morada, telefone e Instagram
- Regras: antecedência mínima (60 min), até quantos dias se pode marcar (30) e até quando se pode cancelar (2h antes)

## Estrutura

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
