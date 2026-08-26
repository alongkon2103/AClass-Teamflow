# TeamFlow — ข้อกำหนด (Specification)

> เอกสารนี้คือ source of truth ของโปรเจกต์ TeamFlow ทำงานทีละ Phase และหยุดรอรีวิวท้ายแต่ละ Phase

## 0. บริบทและเป้าหมาย

สร้างเว็บแอป **TeamFlow** — ระบบจัดการงานของทีมพัฒนาเกมขนาดเล็ก (4–15 คน) ใช้จริงภายในองค์กร
ไม่ใช่ prototype, ไม่ใช่ demo — ต้อง deploy ขึ้น production ได้จริง มี auth จริง, DB จริง, migration จริง

**ผู้ใช้มี 2 บทบาท**

- `LEADER` — หัวหน้าทีม เห็นภาพรวมทุกคน มอบหมายงาน จัดการสมาชิก จัดการคลังเกม อนุมัติการลา
- `MEMBER` — ทีมงาน เห็นและจัดการเฉพาะงานของตัวเอง ส่งความคืบหน้า ขอลา

**หลักการสำคัญ**: ทุก query ต้องกรองสิทธิ์ที่ฝั่ง server เสมอ ห้ามพึ่ง UI ซ่อนปุ่มอย่างเดียว

## 1. Tech Stack (บังคับ)

| ส่วน          | เทคโนโลยี                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router, Server Components เป็นหลัก)                                                         |
| ภาษา          | TypeScript strict mode (`"strict": true`, ห้าม `any` ที่ไม่จำเป็น)                                          |
| DB            | PostgreSQL 16                                                                                               |
| ORM           | Prisma (schema + migrations + seed)                                                                         |
| Auth          | Auth.js (NextAuth v5) — Credentials provider, session แบบ JWT                                               |
| Password      | `bcryptjs` (cost 12)                                                                                        |
| Styling       | Tailwind CSS v4 + CSS variables สำหรับ theme                                                                |
| Components    | shadcn/ui (เฉพาะที่จำเป็น: dialog, select, dropdown-menu, toast, tabs, popover)                             |
| Icons         | **lucide-react เท่านั้น**                                                                                   |
| Forms         | react-hook-form + zod                                                                                       |
| Validation    | zod — ใช้ schema เดียวกันทั้ง client และ server                                                             |
| Data mutation | Next.js Server Actions (ไม่ต้องทำ REST API เว้นแต่จำเป็น)                                                   |
| Date          | `date-fns` + `date-fns-tz` (timezone `Asia/Bangkok`)                                                        |
| File upload   | รูปความคืบหน้า → object storage (S3-compatible / Vercel Blob) เก็บเฉพาะ URL ใน DB **ห้ามเก็บ base64 ลง DB** |
| Testing       | Vitest (unit) + Playwright (e2e เส้นทางหลัก)                                                                |
| Lint          | ESLint + Prettier + `eslint-config-next`                                                                    |

**ห้าม**: localStorage เก็บ business data, mock data ค้างใน production path, `useEffect` ดึงข้อมูลที่ควรทำใน Server Component

## 2. Data Model (Prisma)

ดู `prisma/schema.prisma` — enums: `Role`, `TaskStatus`, `Priority`, `FeedbackStatus`,
`LeaveStatus`, `NotificationType`. models: `User`, `Task`, `ProgressEntry`, `Game`,
`Feedback`, `Leave`, `Notification`

**หมายเหตุสำคัญ**

- ฟิลด์วันที่ที่เป็น "วันปฏิทิน" (startDate, dueDate, entryDate, leave dates) ใช้ `@db.Date` ไม่ใช่ timestamp — กัน bug timezone เพี้ยนข้ามวัน
- ตอนอ่าน/เขียนวันที่ ให้ normalize เป็น `Asia/Bangkok` ที่ชั้น service เสมอ
- `ticketNumber` generate ด้วย transaction + advisory lock หรือ sequence ของ Postgres เพื่อกันเลขชนกัน **ห้าม** ใช้ `count() + 1` เฉยๆ

## 3. โครงสร้างโปรเจกต์

```
app/
  (auth)/login/page.tsx
  (app)/
    layout.tsx                 // header + nav + theme provider + session guard
    dashboard/page.tsx         // LEADER เท่านั้น
    board/page.tsx             // ทุกคน (LEADER มี user switcher)
    calendar/page.tsx
    feedback/page.tsx
    settings/
      members/page.tsx         // LEADER
      games/page.tsx           // LEADER
  api/auth/[...nextauth]/route.ts
  api/upload/route.ts          // presigned URL สำหรับรูป
components/
  ui/                          // shadcn
  kanban/                      // Board, Column, TaskCard (client)
  calendar/                    // MonthGrid, DayCell, DayDetailSheet
  feedback/                    // FeedbackList, FeedbackCard, ReplyForm
  shared/                      // Avatar, StatCard, StatusBadge, PriorityBadge, EmptyState
lib/
  auth.ts                      // authOptions + helper getSession/requireRole
  db.ts                        // PrismaClient singleton
  permissions.ts               // can(user, action, resource)
  date.ts                      // helper timezone Bangkok
  validators/                  // zod schemas
server/
  actions/                     // task.ts, progress.ts, feedback.ts, leave.ts, game.ts, member.ts
  services/                    // business logic ล้วน ไม่แตะ req/res — เทสได้
prisma/
  schema.prisma
  seed.ts
  migrations/
```

**กฎ**: Server Action = validate + authz + เรียก service. Business logic อยู่ใน `server/services/` ทั้งหมด เพื่อให้ unit test ได้โดยไม่ต้อง mock Next.js

## 4. สิทธิ์ (RBAC) — บังคับใช้ทุก action

เขียนเป็นฟังก์ชัน `lib/permissions.ts` แล้วเรียกใช้ทุกที่ ห้าม hardcode เช็คซ้ำๆ กระจาย

| Action                        | LEADER          | MEMBER                                                                |
| ----------------------------- | --------------- | --------------------------------------------------------------------- |
| ดูงานทุกคน                    | ✔               | ✘ (เห็นเฉพาะที่ assign ให้ตัวเอง)                                     |
| สร้าง/แก้/ลบงาน               | ✔ ทุกงาน        | ✔ เฉพาะงานตัวเอง (แก้ status/desc ได้ แต่**เปลี่ยน assignee ไม่ได้**) |
| มอบหมายงานให้คนอื่น           | ✔               | ✘                                                                     |
| ส่งความคืบหน้า                | ✔               | ✔ เฉพาะงานตัวเอง                                                      |
| ลบความคืบหน้า                 | ✔               | ✔ เฉพาะที่ตัวเองเขียน                                                 |
| จัดการคลังเกม                 | ✔               | ✘ (เลือกจากรายการได้อย่างเดียว)                                       |
| สร้าง Feedback                | ✔               | ✔                                                                     |
| ตอบกลับ/เปลี่ยนสถานะ Feedback | ✔               | ✘                                                                     |
| ขอลา                          | ✔ (แทนใครก็ได้) | ✔ เฉพาะตัวเอง                                                         |
| อนุมัติ/ปฏิเสธการลา           | ✔               | ✘                                                                     |
| จัดการสมาชิก                  | ✔               | ✘                                                                     |

MEMBER ที่พยายามเข้า `/dashboard` → redirect ไป `/board` (เช็คใน layout/middleware)

## 5. ฟีเจอร์รายหน้า

- **5.1 Login** — email + password, error inline (ไม่บอกว่าผิดอันไหน), rate limit 5/นาที/IP,
  หลัง login: LEADER → `/dashboard`, MEMBER → `/board`, มี flow เปลี่ยนรหัสผ่านตัวเอง
- **5.2 Dashboard (LEADER)** — การ์ดสถิติ 5 ใบ, โดนัทชาร์ต SVG, ภาระงานรายบุคคล, ตารางงาน
  (ค้นหา debounce 300ms + ฟิลเตอร์ member/status/priority sync URL, overdue สีแดง, pagination 20/หน้า)
- **5.3 Kanban Board** — 4 คอลัมน์, dnd-kit drag&drop (optimistic + rollback), keyboard accessible,
  LEADER มี user switcher (`?user=xxx`), การ์ดแสดง priority/title/desc/deadline/avatar/จำนวนอัพเดท
- **5.4 Task Dialog** — ฟิลด์งาน + ความคืบหน้ารายวัน (timeline, แนบรูป preview 5MB jpg/png/webp,
  ส่งแล้วบันทึกทันที, MEMBER ส่ง → notify LEADER ทุกคนใน transaction เดียว, โผล่บนปฏิทินตาม entryDate)
- **5.5 ปฏิทิน** — month grid, ไฮไลต์ส้มวันมีคนลา (APPROVED เต็ม/PENDING ขอบประ), จุดน้ำเงินความคืบหน้า,
  ข้อความแดง deadline, วันนี้ขอบ primary, คลิกวันเปิด sheet, legend, ขอลา + อนุมัติ (LEADER)
- **5.6 Feedback** — การ์ด + Ticket (TK-0001) + สถานะ + เกมจากคลัง, ตอบกลับ (LEADER) 3 สถานะ
  (PENDING/FIXING/DISMISSED), FIXING → สร้าง Task ผูก linkedTaskId, ฟิลเตอร์ sync URL
- **5.7 คลังเกม (LEADER)** — เพิ่ม (unique case-insensitive), ปิดใช้งานแทนลบถ้ามีอ้างอิง, ลบถาวรได้ถ้าไม่มีอ้างอิง
- **5.8 สมาชิก (LEADER)** — เพิ่ม/แก้/ปิดใช้งาน, รหัสชั่วคราวบังคับเปลี่ยนครั้งแรก, สุ่ม avatarColor ไม่ซ้ำ
- **5.9 การแจ้งเตือน** — กระดิ่ง + badge, dropdown 20 รายการ, คลิก mark read + navigate,
  polling 60 วิ (ห้าม WebSocket เกินจำเป็น), MEMBER รับ TASK_ASSIGNED/LEAVE_DECIDED/FEEDBACK_REPLIED

## 6. Design System

ดูรายละเอียดเต็มในข้อ 6 ของข้อกำหนดต้นฉบับ สรุปกฎสำคัญ:

- Theme tokens เป็น CSS variables ใน `globals.css` (light + `.dark`), toggle ด้วย `next-themes`
  เก็บใน cookie, **ห้าม flash of wrong theme**
- สีเชิงความหมายคงที่สองธีม: ต้องทำ `#4C8DFF`, กำลังทำ `#F5A623`, รอส่งตรวจ `#A66BFF`,
  เสร็จ `#28C76F`, อันตราย/เลยกำหนด `#F0616D`, การลา (ส้ม) `#F5943B`
- Container `1240px`, Header `64px` sticky, radius การ์ด `18px`/ปุ่ม `11–14px`/badge `9999px`
- ฟอนต์ `Inter` + `IBM Plex Sans Thai` ผ่าน `next/font` (ไม่ใช้ system default)
- **Icon = lucide-react เท่านั้น — ห้าม emoji ใน UI ที่ผู้ใช้เห็นทุกกรณี**
- กฎกัน UI slop: ห้าม gradient ตกแต่ง (ยกเว้นโลโก้ + workload bar), ห้าม glassmorphism/neon/เงาสี,
  ห้ามเงาหนา, อนิเมชัน ≤200ms เคารพ `prefers-reduced-motion`, empty state เรียบ, 1 primary/หน้าจอ,
  spacing scale 4px, loading = skeleton, ตัวเลขมีบริบท, contrast WCAG AA, `:focus-visible` ชัด, responsive

## 7. Non-functional Requirements

- **Env**: `.env.example` ครบ + validate ด้วย zod ตอน boot (ขาดให้ crash บอกตัวที่ขาด)
- **Seed**: LEADER 1 + MEMBER 3 + เกม 3 + งาน 6 (มี progress) + feedback 3 (สถานะต่างกัน) + ลา 2 (PENDING 1, APPROVED 1)
- **Error handling**: `error.tsx` + `not-found.tsx` ทุก route group, Server Action คืน `{ ok, message }` ภาษาไทย → toast
- **Optimistic UI** ที่ drag&drop และ mark read
- **N+1**: ใช้ `include`/`select` พอดี
- **Security**: rate limit login, CSRF ผ่าน Auth.js, ไม่ใช้ `dangerouslySetInnerHTML`, ตรวจ mime+ขนาดไฟล์ฝั่ง server, ไม่ log password/token
- **Docker**: `docker-compose.yml` postgres + adminer
- **README**: setup 0 → deploy + บัญชีทดสอบ
- **Tests**: unit (permissions, ticket number, leave overlap, date normalize) / e2e (login → สร้างงาน → ลาก → ส่งความคืบหน้า → LEADER เห็นแจ้งเตือน)

## 8. ลำดับการทำงาน

| Phase | สิ่งที่ต้องได้                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------- |
| 0     | init Next.js + TS + Tailwind + shadcn + ESLint/Prettier, docker-compose, env validation, README |
| 1     | Prisma schema + migration แรก + seed รันผ่าน                                                    |
| 2     | Auth.js credentials, login, middleware, `lib/permissions.ts` + unit test                        |
| 3     | App shell: header, nav, theme toggle (ไม่ flash), tokens, component พื้นฐาน                     |
| 4     | Kanban + drag&drop + task dialog (ยังไม่มีความคืบหน้า)                                          |
| 5     | ความคืบหน้า + อัปโหลดรูป + notification                                                         |
| 6     | Dashboard: สถิติ, โดนัท, workload, ตาราง + ฟิลเตอร์ + pagination                                |
| 7     | คลังเกม + Feedback ครบ                                                                          |
| 8     | ปฏิทิน + ลางาน + อนุมัติ + ไฮไลต์ส้ม                                                            |
| 9     | สมาชิก, เปลี่ยนรหัส, ขัดเกลา UI, a11y + contrast                                                |
| 10    | e2e tests, performance, เอกสาร deploy                                                           |

## 9. เกณฑ์ตรวจรับ (Definition of Done)

- [ ] `pnpm build` ผ่าน ไม่มี TS error / ESLint warning
- [ ] ไม่มี `any`, ไม่มี `@ts-ignore` ที่ไม่มีคอมเมนต์
- [ ] ไม่มี emoji ใน UI
- [ ] ทุก mutation ผ่าน zod ทั้ง client + server
- [ ] ทุก query กรองสิทธิ์ฝั่ง server (MEMBER ยิง action แล้วถูกปฏิเสธ)
- [ ] สองธีม contrast ผ่าน AA
- [ ] Keyboard navigate ได้ มี focus ring
- [ ] ไม่มี console error/warning ตอนใช้งานปกติ
- [ ] Seed ทำให้ทุกหน้ามีข้อมูลครบทุกสถานะ

## 10. คำสั่งเสริม

- ทางเลือกที่ spec ไม่ระบุ → ถามก่อน
- ไม่ติดตั้ง dependency นอกเหนือที่ระบุโดยไม่บอกเหตุผล
- commit เป็นช่วงตาม Phase (conventional commits ภาษาอังกฤษ)
- คอมเมนต์เท่าที่จำเป็น เน้น "ทำไม"
- UI copy ภาษาไทย, โค้ด/ตัวแปร/คอมเมนต์ภาษาอังกฤษ
- spec ขัดกันเอง → ชี้ให้เห็นแล้วเสนอทางออก
