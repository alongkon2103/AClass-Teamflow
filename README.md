# TeamFlow

ระบบจัดการงานของทีมพัฒนาเกมขนาดเล็ก — Kanban board, ปฏิทินความคืบหน้า/การลา,
คลังเกม, customer feedback และการแจ้งเตือน แยกสิทธิ์ระหว่างหัวหน้าทีม (`LEADER`)
และทีมงาน (`MEMBER`) โดยกรองสิทธิ์ที่ฝั่ง server ทุก query

> สถานะ: อยู่ระหว่างพัฒนา (Phase 0–2 — scaffold, database layer, auth + RBAC)

## Tech stack

- **Next.js 15** (App Router, Server Components + Server Actions)
- **TypeScript** strict mode
- **PostgreSQL 16** + **Prisma** (schema / migrations / seed)
- **Auth.js (NextAuth v5)** — Credentials provider, JWT session, `bcryptjs`
- **Tailwind CSS v4** + **shadcn/ui** (Base UI) + **lucide-react**
- **react-hook-form** + **zod** (schema เดียวใช้ทั้ง client และ server)
- **Vitest** (unit) + **Playwright** (e2e)

## Requirements

- Node.js 20+
- pnpm 10 (`corepack use pnpm@10` หรือ `corepack prepare pnpm@10.15.1 --activate`)
- ฐานข้อมูล PostgreSQL 16 — เลือกอย่างใดอย่างหนึ่ง:
  - **Supabase** (ทีมนี้ใช้สำหรับ dev) — เอา connection string มาใส่ใน `.env`
  - **Docker** ในเครื่อง — `docker compose up -d` (มาพร้อม Adminer ที่ `:8080`)

## Setup ตั้งแต่ศูนย์

```bash
# 1) ติดตั้ง dependencies
pnpm install

# 2) เตรียมไฟล์ .env
cp .env.example .env
#    - ใส่ DATABASE_URL / DIRECT_URL (Supabase หรือ docker)
#    - สร้าง AUTH_SECRET:  openssl rand -base64 32

# 3) (ทางเลือก) ถ้าใช้ docker แทน Supabase
docker compose up -d

# 4) รัน migration + seed
pnpm prisma migrate deploy   # หรือ `pnpm prisma migrate dev` ตอนพัฒนา schema
pnpm prisma db seed

# 5) รัน dev server
pnpm dev
```

เปิด http://localhost:3000

### หมายเหตุ Supabase

Supabase มี connection string สองแบบ — ตั้งค่าให้ถูก มิฉะนั้น migration จะพัง:

- `DATABASE_URL` → **Connection pooling** (port `6543`) ต่อท้ายด้วย
  `?pgbouncer=true&connection_limit=1` (ใช้ตอน runtime)
- `DIRECT_URL` → **Direct connection** (port `5432`) (Prisma ใช้ตอน migrate)

## Scripts

| คำสั่ง           | หน้าที่                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | รัน dev server                   |
| `pnpm build`     | build production                 |
| `pnpm start`     | รัน production server            |
| `pnpm lint`      | ESLint                           |
| `pnpm typecheck` | ตรวจ TypeScript (`tsc --noEmit`) |
| `pnpm format`    | จัดรูปแบบด้วย Prettier           |

## บัญชีทดสอบ (หลัง seed)

รหัสผ่านเดียวกันทุกบัญชี: `password1234`

| Role   | Email               | ชื่อ           | ตำแหน่ง     |
| ------ | ------------------- | -------------- | ----------- |
| LEADER | leader@teamflow.app | กมล ประสิทธิ์  | หัวหน้าทีม  |
| MEMBER | napa@teamflow.app   | นภา จันทร์เพ็ญ | Developer   |
| MEMBER | thana@teamflow.app  | ธนา รักดี      | Designer    |
| MEMBER | ploy@teamflow.app   | พลอย ศิริวงศ์  | QA Engineer |

## โครงสร้างโปรเจกต์

ดู [`SPEC.md`](SPEC.md) สำหรับข้อกำหนดฉบับเต็ม โครงสร้างหลัก:

```
app/        — routes (App Router)
components/  — UI components (ui/, kanban/, calendar/, feedback/, shared/)
lib/         — auth, db, permissions, date helpers, zod validators, env
server/      — actions/ (validate + authz) และ services/ (business logic ล้วน)
prisma/      — schema, migrations, seed
```
