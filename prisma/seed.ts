import {
  PrismaClient,
  Role,
  TaskStatus,
  Priority,
  FeedbackStatus,
  LeaveStatus,
  NotificationType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { todayInBangkok, addCalendarDays } from "../lib/date";

const prisma = new PrismaClient();

// Shared dev password for every seeded account. Documented in the README.
const DEV_PASSWORD = "password1234";
const BCRYPT_COST = 12;

// Distinct avatar colors (see design tokens). One per seeded user, no repeats.
const PALETTE = ["#2E7CF6", "#F5A623", "#28C76F", "#A66BFF"];

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);
  const today = todayInBangkok();
  const day = (offset: number) => addCalendarDays(today, offset);

  // --- Reset (dev only) in FK-dependency order ------------------------------
  // Accounts created outside the seed (a real leader, for example) are left
  // alone, so re-seeding for tests never destroys a working login.
  const SEEDED_EMAILS = [
    "leader@teamflow.app",
    "napa@teamflow.app",
    "thana@teamflow.app",
    "ploy@teamflow.app",
  ];

  await prisma.notification.deleteMany();
  await prisma.progressEntry.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.task.deleteMany();
  await prisma.game.deleteMany();
  await prisma.user.deleteMany({ where: { email: { in: SEEDED_EMAILS } } });

  // --- Users ----------------------------------------------------------------
  const leader = await prisma.user.create({
    data: {
      email: "leader@teamflow.app",
      name: "กมล ประสิทธิ์",
      passwordHash,
      role: Role.LEADER,
      jobTitle: "หัวหน้าทีม",
      avatarColor: PALETTE[0],
    },
  });
  const napa = await prisma.user.create({
    data: {
      email: "napa@teamflow.app",
      name: "นภา จันทร์เพ็ญ",
      passwordHash,
      role: Role.MEMBER,
      jobTitle: "Developer",
      avatarColor: PALETTE[1],
    },
  });
  const thana = await prisma.user.create({
    data: {
      email: "thana@teamflow.app",
      name: "ธนา รักดี",
      passwordHash,
      role: Role.MEMBER,
      jobTitle: "Designer",
      avatarColor: PALETTE[2],
    },
  });
  const ploy = await prisma.user.create({
    data: {
      email: "ploy@teamflow.app",
      name: "พลอย ศิริวงศ์",
      passwordHash,
      role: Role.MEMBER,
      jobTitle: "QA Engineer",
      avatarColor: PALETTE[3],
    },
  });

  // --- Games ----------------------------------------------------------------
  const mysticRealm = await prisma.game.create({
    data: { name: "Mystic Realm" },
  });
  const pixelRacer = await prisma.game.create({
    data: { name: "Pixel Racer" },
  });
  const galaxyGuard = await prisma.game.create({
    data: { name: "Galaxy Guard" },
  });

  // --- Tasks (spread across all 4 columns, mixed priorities) ----------------
  const t1 = await prisma.task.create({
    data: {
      title: "ออกแบบระบบด่านใหม่",
      description: "วางเลย์เอาต์ด่าน 4-6 พร้อมกับดักและศัตรู",
      status: TaskStatus.DOING,
      priority: Priority.IMPORTANT,
      startDate: day(-5),
      dueDate: day(2),
      sortOrder: 0,
      assigneeId: napa.id,
      createdById: leader.id,
      gameId: mysticRealm.id,
    },
  });
  // Overdue on purpose (dueDate in the past) to exercise the "เลยกำหนด" state.
  await prisma.task.create({
    data: {
      title: "แก้บั๊กการชนของตัวละคร",
      description: "ตัวละครทะลุพื้นเมื่อกระโดดชนขอบแพลตฟอร์ม",
      status: TaskStatus.TODO,
      priority: Priority.URGENT,
      startDate: day(-2),
      dueDate: day(-1),
      sortOrder: 0,
      assigneeId: thana.id,
      createdById: leader.id,
      gameId: pixelRacer.id,
    },
  });
  const t3 = await prisma.task.create({
    data: {
      title: "ทำ UI หน้าร้านค้าในเกม",
      description: "หน้าซื้อไอเทมพร้อมตะกร้าและยืนยันการซื้อ",
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      startDate: day(0),
      dueDate: day(7),
      sortOrder: 1,
      assigneeId: ploy.id,
      createdById: leader.id,
      gameId: galaxyGuard.id,
    },
  });
  const t4 = await prisma.task.create({
    data: {
      title: "ปรับสมดุลอาวุธ",
      description: "ลดดาเมจปืนกลและเพิ่มระยะเวลาคูลดาวน์",
      status: TaskStatus.REVIEW,
      priority: Priority.IMPORTANT,
      startDate: day(-7),
      dueDate: day(1),
      sortOrder: 0,
      assigneeId: napa.id,
      createdById: leader.id,
      gameId: pixelRacer.id,
    },
  });
  const t5 = await prisma.task.create({
    data: {
      title: "เพิ่มระบบเสียงประกอบ",
      description: "ใส่ BGM และ SFX ครบทุกฉากหลัก",
      status: TaskStatus.DONE,
      priority: Priority.NORMAL,
      startDate: day(-14),
      dueDate: day(-3),
      sortOrder: 0,
      assigneeId: thana.id,
      createdById: leader.id,
      gameId: mysticRealm.id,
    },
  });
  const t6 = await prisma.task.create({
    data: {
      title: "เขียนเทสต์ระบบล็อกอิน",
      description: "ครอบคลุมเคสรหัสผ่านผิด บัญชีถูกปิด และ rate limit",
      status: TaskStatus.DOING,
      priority: Priority.NORMAL,
      startDate: day(-3),
      dueDate: day(4),
      sortOrder: 1,
      assigneeId: ploy.id,
      createdById: leader.id,
      gameId: galaxyGuard.id,
    },
  });

  // --- Progress entries (recent, land on the calendar) ----------------------
  await prisma.progressEntry.createMany({
    data: [
      {
        taskId: t1.id,
        authorId: napa.id,
        entryDate: day(-2),
        body: "ร่างเลย์เอาต์ด่าน 4 เสร็จ วางตำแหน่งศัตรูคร่าว ๆ แล้ว",
      },
      {
        taskId: t1.id,
        authorId: napa.id,
        entryDate: day(0),
        body: "เริ่มวางกับดักในด่าน 5 และปรับจังหวะการเดินของศัตรู",
      },
      {
        taskId: t4.id,
        authorId: napa.id,
        entryDate: day(-1),
        body: "ปรับค่าดาเมจอาวุธหลักลง 15% รอทีมรีวิว",
      },
      {
        taskId: t6.id,
        authorId: ploy.id,
        entryDate: day(0),
        body: "เขียนเทสต์ครอบคลุม 8 เคสหลักของหน้าล็อกอินแล้ว",
      },
      {
        taskId: t5.id,
        authorId: thana.id,
        entryDate: day(-3),
        body: "ใส่เสียง BGM ครบทุกฉากหลัก เหลือปรับระดับเสียง SFX",
      },
    ],
  });

  // --- Customer feedback (one per status) -----------------------------------
  await prisma.feedback.create({
    data: {
      ticketNumber: "TK-0001",
      customerName: "ร้านเกมสยาม",
      reportedAt: day(-4),
      gameId: pixelRacer.id,
      body: "ตัวละครกระโดดแล้วทะลุพื้นในด่าน 3 บ่อยครั้ง",
      status: FeedbackStatus.PENDING,
    },
  });
  await prisma.feedback.create({
    data: {
      ticketNumber: "TK-0002",
      customerName: "คุณสมชาย ใจดี",
      reportedAt: day(-6),
      gameId: mysticRealm.id,
      body: "อยากให้เพิ่มโหมดเล่นหลายคน (co-op)",
      status: FeedbackStatus.FIXING,
      replyBody: "รับเรื่องแล้ว กำลังพัฒนาโหมด co-op อยู่ในแผนด่านใหม่",
      repliedById: leader.id,
      repliedAt: day(-5),
      linkedTaskId: t1.id,
    },
  });
  await prisma.feedback.create({
    data: {
      ticketNumber: "TK-0003",
      customerName: "คุณมานี รักเกม",
      reportedAt: day(-8),
      gameId: galaxyGuard.id,
      body: "เสียงเอฟเฟกต์ดังเกินไปเมื่อเทียบกับเสียงเพลง",
      status: FeedbackStatus.DISMISSED,
      replyBody: "สามารถปรับระดับเสียงแยกได้ในหน้าตั้งค่าเสียงครับ",
      repliedById: leader.id,
      repliedAt: day(-7),
    },
  });

  // --- Leaves (one PENDING, one APPROVED spanning today) --------------------
  const pendingLeave = await prisma.leave.create({
    data: {
      userId: napa.id,
      startDate: day(1),
      endDate: day(2),
      reason: "ไปธุระต่างจังหวัด",
      status: LeaveStatus.PENDING,
    },
  });
  const approvedLeave = await prisma.leave.create({
    data: {
      userId: thana.id,
      startDate: day(-1),
      endDate: day(1),
      reason: "ลาป่วย",
      status: LeaveStatus.APPROVED,
      decidedById: leader.id,
      decidedAt: day(-2),
    },
  });

  // --- Notifications (populate the bell for both roles) ---------------------
  await prisma.notification.createMany({
    data: [
      {
        recipientId: leader.id,
        actorId: napa.id,
        type: NotificationType.PROGRESS_SUBMITTED,
        payload: {
          taskId: t1.id,
          taskTitle: t1.title,
          excerpt: "เริ่มวางกับดักในด่าน 5 และปรับจังหวะการเดินของศัตรู",
        },
      },
      {
        recipientId: leader.id,
        actorId: napa.id,
        type: NotificationType.LEAVE_REQUESTED,
        payload: {
          leaveId: pendingLeave.id,
          userName: napa.name,
          range: "พรุ่งนี้ - มะรืนนี้",
        },
      },
      {
        recipientId: thana.id,
        actorId: leader.id,
        type: NotificationType.LEAVE_DECIDED,
        payload: {
          leaveId: approvedLeave.id,
          status: LeaveStatus.APPROVED,
          reason: "ลาป่วย",
        },
        readAt: day(-1),
      },
      {
        recipientId: ploy.id,
        actorId: leader.id,
        type: NotificationType.TASK_ASSIGNED,
        payload: { taskId: t3.id, taskTitle: t3.title },
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    games: await prisma.game.count(),
    tasks: await prisma.task.count(),
    progress: await prisma.progressEntry.count(),
    feedback: await prisma.feedback.count(),
    leaves: await prisma.leave.count(),
    notifications: await prisma.notification.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`Login with any *@teamflow.app / ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
