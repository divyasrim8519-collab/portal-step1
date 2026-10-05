import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RULES } from '../lib/default-rules.mjs';

const prisma = new PrismaClient();

const need = (k) => {
  const v = process.env[k];
  if (!v || v.length < 8) {
    console.error(`Missing ${k} (min 8 chars). Set it in your environment before seeding.`);
    process.exit(1);
  }
  return v;
};


async function main() {
  const adminPw = need('SEED_ADMIN_PASSWORD');
  const clientPw = need('SEED_CLIENT_PASSWORD');
  const empPw = need('SEED_EMPLOYEE_PASSWORD');
  const hash = (p) => bcrypt.hashSync(p, 12);

  const people = [
    { email: 'admin@demo.example', realName: 'Asha Verma (Admin)', phone: '+91 90000 00001', role: 'ADMIN', pw: adminPw },
    { email: 'client1@demo.example', realName: 'Rohan Mehta', phone: '+91 90000 00002', role: 'CLIENT', pw: clientPw },
    { email: 'client2@demo.example', realName: 'Priya Nair', phone: '+91 90000 00003', role: 'CLIENT', pw: clientPw },
    { email: 'employee1@demo.example', realName: 'Karan Shah', phone: '+91 90000 00004', role: 'EMPLOYEE', pw: empPw },
    { email: 'employee2@demo.example', realName: 'Meera Iyer', phone: '+91 90000 00005', role: 'EMPLOYEE', pw: empPw },
  ];
  const users = {};
  for (const p of people) {
    users[p.email] = await prisma.user.upsert({
      where: { email: p.email },
      update: { realName: p.realName, phone: p.phone, role: p.role, isActive: true, passwordHash: hash(p.pw) },
      create: { email: p.email, realName: p.realName, phone: p.phone, role: p.role, passwordHash: hash(p.pw) },
    });
  }

  for (const r of RULES) {
    await prisma.rule.upsert({ where: { name: r.name }, update: {}, create: r });
  }

  async function project(name, description, members, messages) {
    let proj = await prisma.project.findFirst({ where: { name } });
    if (!proj) proj = await prisma.project.create({ data: { name, description } });
    const conv = await prisma.conversation.upsert({
      where: { projectId: proj.id }, update: {}, create: { projectId: proj.id },
    });
    const ms = {};
    for (const m of members) {
      ms[m.role] = await prisma.membership.upsert({
        where: { projectId_userId: { projectId: proj.id, userId: users[m.email].id } },
        update: { status: 'ACTIVE', revokedAt: null, alias: m.alias },
        create: { projectId: proj.id, userId: users[m.email].id, role: m.role, alias: m.alias },
      });
    }
    const existing = await prisma.message.count({ where: { conversationId: conv.id } });
    if (existing === 0) {
      let t = Date.now() - messages.length * 60000;
      for (let i = 0; i < messages.length; i++) {
        const [who, body] = messages[i];
        const when = new Date(t + i * 60000);
        await prisma.message.create({
          data: {
            conversationId: conv.id, senderMembershipId: ms[who].id, body,
            clientMessageId: `seed-${proj.id}-${i}`, status: 'DELIVERED',
            createdAt: when, deliveredAt: when,
          },
        });
      }
    }
  }

  await project('Website Redesign', 'Refresh of the marketing site.',
    [
      { email: 'client1@demo.example', role: 'CLIENT', alias: 'Client A' },
      { email: 'employee1@demo.example', role: 'EMPLOYEE', alias: 'Project Specialist B' },
    ],
    [
      ['EMPLOYEE', 'Hello! I have started on the homepage wireframes.'],
      ['CLIENT', 'Great. Could the hero section highlight our new product line?'],
      ['EMPLOYEE', 'Yes, I will include that in the first draft.'],
      ['CLIENT', 'Perfect, thank you.'],
    ]);

  await project('Mobile App MVP', 'First release of the booking app.',
    [
      { email: 'client2@demo.example', role: 'CLIENT', alias: 'Client A' },
      { email: 'employee1@demo.example', role: 'EMPLOYEE', alias: 'Project Specialist A' },
    ],
    [
      ['CLIENT', 'Hi, can we review the onboarding flow this week?'],
      ['EMPLOYEE', 'Sure. I will share the screens for feedback.'],
      ['CLIENT', 'Sounds good.'],
    ]);

  console.log('Seed complete. Demo accounts: admin@, client1@, client2@, employee1@, employee2@demo.example');
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
