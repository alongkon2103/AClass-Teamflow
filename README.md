# TeamFlow

ระบบจัดการงานของทีมพัฒนาเกมขนาดเล็ก (4–15 คน) — Kanban board, ปฏิทินความคืบหน้าและวันลา,
คลังเกม, customer feedback และการแจ้งเตือน แยกสิทธิ์ระหว่างหัวหน้าทีม (`LEADER`)
และทีมงาน (`MEMBER`) โดย**กรองสิทธิ์ที่ฝั่ง server ทุก query** ไม่ได้พึ่งการซ่อนปุ่มใน UI

## Tech stack

- **Next.js 15** (App Router, Server Components + Server Actions)
- **TypeScript** strict mode — ไม่มี `any` และไม่มี `@ts-ignore`
- **PostgreSQL 16** + **Prisma 6** (schema / migrations / seed)
- **Auth.js (NextAuth v5)** — Credentials provider, JWT session, `bcryptjs` cost 12
- **Tailwind CSS v4** + **shadcn/ui** + **lucide-react** (ไม่มี emoji ใน UI)
- **react-hook-form** + **zod** — schema เดียวใช้ทั้ง client และ server
- **@dnd-kit** สำหรับลากวางบนบอร์ด
- **Vitest** (138 unit tests) + **Playwright** (13 e2e tests)

## Requirements

- Node.js 20+
- pnpm 10 — `corepack prepare pnpm@10.15.1 --activate`
- PostgreSQL 16

## Setup ตั้งแต่ศูนย์

```bash
# 1) ติดตั้ง dependencies
pnpm install

# 2) เตรียม .env
cp .env.example .env
#    - ใส่ DATABASE_URL / DIRECT_URL
#    - สร้าง AUTH_SECRET:  openssl rand -base64 32

# 3) (ทางเลือก) ใช้ Postgres ในเครื่องผ่าน docker
docker compose up -d

# 4) migration + seed
pnpm db:migrate      # production ใช้ตัวนี้ (prisma migrate deploy)
pnpm db:seed

# 5) รัน
pnpm dev
```

เปิด http://localhost:3000

## บัญชีทดสอบ (หลัง seed)

รหัสผ่านเดียวกันทุกบัญชี: `password1234`

| Role   | Email               | ชื่อ           | ตำแหน่ง     |
| ------ | ------------------- | -------------- | ----------- |
| LEADER | leader@teamflow.app | กมล ประสิทธิ์  | หัวหน้าทีม  |
| MEMBER | napa@teamflow.app   | นภา จันทร์เพ็ญ | Developer   |
| MEMBER | thana@teamflow.app  | ธนา รักดี      | Designer    |
| MEMBER | ploy@teamflow.app   | พลอย ศิริวงศ์  | QA Engineer |

`pnpm db:seed` จะรีเซ็ตเฉพาะบัญชีสี่รายการนี้ บัญชีอื่นที่สร้างเองจะไม่ถูกลบ

สร้าง LEADER คนแรกบนเครื่อง production:

```bash
pnpm user:create <email> <password> <ชื่อ> LEADER "ตำแหน่ง"
```

## Scripts

| คำสั่ง                         | หน้าที่                            |
| ------------------------------ | ---------------------------------- |
| `pnpm dev`                     | dev server                         |
| `pnpm build` / `pnpm start`    | build และรัน production            |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript                |
| `pnpm test`                    | unit tests (Vitest)                |
| `pnpm test:e2e`                | seed แล้วรัน e2e (Playwright)      |
| `pnpm db:migrate`              | `prisma migrate deploy`            |
| `pnpm db:seed`                 | ใส่ข้อมูลตัวอย่าง                  |
| `pnpm user:create`             | สร้าง/รีเซ็ตผู้ใช้จาก command line |

## การทดสอบ

**Unit** ครอบคลุม business logic ล้วน: RBAC, ลำดับ sortOrder, การ normalize วันที่,
contrast ของ design tokens, การ generate ticket number, การหาช่วงวันลาที่ทับซ้อน

**E2E** รันบน production build ไม่ใช่ dev server — Fast Refresh จะ recompile เมื่อไฟล์
เปลี่ยน (รวมถึงไฟล์ที่ Playwright เขียนเอง) ทำให้ Server Action id ที่ค้างอยู่ใช้ไม่ได้และฟอร์มค้าง
ไฟล์ผลลัพธ์จึงถูกเขียนนอก repo ด้วยเหตุผลเดียวกัน

```bash
pnpm build && pnpm start          # เตรียม server
pnpm db:seed                      # ข้อมูลตั้งต้นที่ทดสอบคาดหวัง
E2E_BASE_URL=http://localhost:3000 pnpm exec playwright test
```

หรือให้ Playwright จัดการ server เอง: `pnpm test:e2e`

> e2e ล็อกอินซ้ำหลายครั้งจาก IP เดียว ซึ่งชนกับ rate limit 5 ครั้ง/นาที
> จึงต้องตั้ง `AUTH_RATE_LIMIT_MAX` ให้สูงขึ้นตอนทดสอบ (config จัดการให้แล้ว)
> **ห้ามตั้งค่านี้สูงบน production**

## Deploy

### 0. เตรียมเครื่อง VPS (Ubuntu)

Ubuntu มาพร้อม Node เวอร์ชันเก่าและไม่มี pnpm ให้ติดตั้งก่อน:

```bash
# Node 22 LTS (ที่มากับ apt เป็น Node 18 ซึ่งหมด support แล้ว)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v                                  # ต้องได้ v22.x

# pnpm ผ่าน corepack (เวอร์ชันถูกอ่านจาก packageManager ใน package.json)
sudo corepack enable
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack prepare pnpm@10.15.1 --activate
pnpm -v                                  # ต้องได้ 10.15.1

# PM2
sudo npm install -g pm2
```

**สร้าง `.env` ให้เสร็จก่อน `pnpm build`** — env ถูก validate ตอนโหลดโมดูล
ถ้าขาดตัวแปร build จะล้มพร้อมบอกชื่อตัวที่ขาด

```bash
cp .env.example .env
nano .env        # ใส่ DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_URL
openssl rand -base64 32     # ใช้เป็น AUTH_SECRET
```

### 1. Environment

ตั้งค่าตาม `.env.example` ให้ครบ ตัวที่บังคับ:

| ตัวแปร         | หมายเหตุ                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | connection ที่แอปใช้ตอนรัน (Supabase: pooler port 6543 + `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL`   | connection ตรงสำหรับ migration (Supabase: port 5432)                                           |
| `AUTH_SECRET`  | `openssl rand -base64 32` — อย่าใช้ค่าเดียวกับ dev                                             |
| `AUTH_URL`     | origin จริงของระบบ เช่น `https://teamflow.example.com`                                         |

env ถูก validate ด้วย zod ตอน boot ถ้าขาดตัวไหน process จะหยุดทันทีพร้อมบอกชื่อตัวแปร

### 2. Migration

```bash
pnpm db:migrate     # prisma migrate deploy — ไม่แตะข้อมูลเดิม
```

### 3. Build และรัน

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

### 4. รันด้วย PM2 บน VPS (port 3009)

`ecosystem.config.js` ตั้งค่าไว้พร้อมแล้ว รันครั้งแรก:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 start ecosystem.config.js
pm2 save                       # จำ process list ไว้
pm2 startup                    # ให้ start อัตโนมัติเมื่อ VPS reboot (ทำครั้งเดียว)
```

deploy รอบถัดไป:

```bash
git pull
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 reload teamflow            # restart แบบไม่ให้ request ค้าง
```

คำสั่งที่ใช้บ่อย:

| คำสั่ง                 | หน้าที่                        |
| ---------------------- | ------------------------------ |
| `pm2 logs teamflow`    | ดู log สด (เก็บไว้ที่ `logs/`) |
| `pm2 status`           | สถานะ process                  |
| `pm2 restart teamflow` | restart                        |
| `pm2 stop teamflow`    | หยุด                           |
| `pm2 monit`            | ดู CPU/memory                  |

**ตั้งใจให้รันแค่ instance เดียว** (`exec_mode: fork`, `instances: 1`) เพราะ rate limit
ของหน้า login เก็บสถานะใน memory ของ process ถ้ารัน cluster หลายตัว แต่ละตัวจะนับแยกกัน
ทำให้ยิง login ได้ 5 ครั้ง × จำนวน instance ต่อนาที ซึ่งอ่อนกว่าที่ spec กำหนด
ทีมขนาด 4–15 คน instance เดียวเหลือเฟือ ถ้าจะ scale ต้องย้าย rate limiter ไป Redis ก่อน

> `ecosystem.config.js` ถูก commit ขึ้น repo จึง**ไม่มีความลับอยู่ในไฟล์**
> ค่า `DATABASE_URL` / `DIRECT_URL` / `AUTH_SECRET` / `AUTH_URL` ให้อยู่ใน `.env` บนเครื่อง VPS
> (Next.js อ่านให้ตอน runtime) และ `.env` ถูก gitignore ไว้แล้ว

### 5. Nginx reverse proxy

```nginx
server {
    listen 443 ssl http2;
    server_name teamflow.example.com;

    # ssl_certificate ... (เช่นจาก certbot)

    client_max_body_size 6M;          # รูปความคืบหน้าจำกัด 5MB

    location / {
        proxy_pass http://127.0.0.1:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        # จำเป็น: rate limit ของหน้า login อ่าน IP จาก header นี้
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
    }
}
```

ตั้ง `AUTH_URL="https://teamflow.example.com"` ให้ตรงกับ `server_name`

### 6. อยู่หลัง reverse proxy / tunnel

`trustHost: true` ถูกเปิดไว้ใน `auth.config.ts` เพราะ Auth.js v5 จะปฏิเสธทุก request
ใน production ถ้า Host ไม่ตรงกับที่รู้จัก (`UntrustedHost`) — อาการคือ login ไม่ผ่าน
ทั้งที่ dev ปกติดี ตั้ง `AUTH_URL` ควบคู่ด้วยเพื่อให้ callback URL เป็น absolute ที่ถูกต้อง

ให้ proxy ส่ง `X-Forwarded-For` มาด้วย เพราะ rate limit ของหน้า login อ่านค่าจาก header นี้

### 7. ที่เก็บรูปความคืบหน้า

ค่าเริ่มต้นเก็บลงดิสก์ที่ `.uploads/` และเสิร์ฟผ่าน `/api/uploads/...` หลังการตรวจ session
เหมาะกับการ self-host แต่ต้อง**ผูก volume ให้ถาวร** ไม่งั้นรูปหายเมื่อ redeploy

ถ้าใช้ cloud ให้ตั้ง `STORAGE_PROVIDER`:

- `vercel-blob` + `BLOB_READ_WRITE_TOKEN`
- `s3` + `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_URL`

ทั้งสองแบบเก็บเฉพาะ URL ลงฐานข้อมูล ไม่มี base64 ใน DB

### 8. ข้อจำกัดที่ควรรู้

Rate limit ของ login เก็บสถานะไว้ใน memory ของ process — ถูกต้องสำหรับ instance เดียว
ถ้าจะ scale หลาย instance ต้องเปลี่ยนไปใช้ store ร่วม (Redis/Upstash) ก่อน

## โครงสร้างโปรเจกต์

```
app/
  (auth)/login/          หน้าเข้าสู่ระบบ
  (app)/                 หน้าที่ต้องล็อกอิน (header + nav + session guard)
    dashboard/ board/ calendar/ feedback/ account/ settings/
  api/auth/ api/upload/ api/uploads/
components/  ui/ (shadcn) · kanban/ · calendar/ · feedback/ · dashboard/ · settings/ · shell/ · shared/
lib/         auth · db · permissions · date · format · storage/ · validators/ · env
server/      actions/ (validate + authz)  ·  services/ (business logic ล้วน เทสได้)
prisma/      schema · migrations · seed
tests/       unit/ (Vitest) · e2e/ (Playwright)
```

**กฎ**: Server Action ทำหน้าที่ validate + ตรวจสิทธิ์ + เรียก service เท่านั้น
business logic อยู่ใน `server/services/` ทั้งหมด จึง unit test ได้โดยไม่ต้อง mock Next.js

ดู [`SPEC.md`](SPEC.md) สำหรับข้อกำหนดฉบับเต็ม
