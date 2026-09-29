import "dotenv/config";

import bcrypt from "bcryptjs";
import { NotificationChannel, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        email: "admin@example.com",
        name: "Avery Admin",
        role: UserRole.ADMIN,
        passwordHash,
        phoneNumber: "+15550000001",
        pushToken: "push-admin-1"
      }
    }),
    prisma.user.upsert({
      where: { email: "operator@example.com" },
      update: {},
      create: {
        email: "operator@example.com",
        name: "Ollie Operator",
        role: UserRole.OPERATOR,
        passwordHash,
        phoneNumber: "+15550000002",
        pushToken: "push-operator-1"
      }
    }),
    prisma.user.upsert({
      where: { email: "viewer@example.com" },
      update: {},
      create: {
        email: "viewer@example.com",
        name: "Vera Viewer",
        role: UserRole.VIEWER,
        passwordHash,
        phoneNumber: "+15550000003",
        pushToken: "push-viewer-1"
      }
    }),
    prisma.user.upsert({
      where: { email: "customer.one@example.com" },
      update: {},
      create: {
        email: "customer.one@example.com",
        name: "Casey Customer",
        role: UserRole.VIEWER,
        passwordHash,
        phoneNumber: "+15550000004",
        pushToken: "push-customer-1"
      }
    }),
    prisma.user.upsert({
      where: { email: "customer.two@example.com" },
      update: {},
      create: {
        email: "customer.two@example.com",
        name: "Taylor Customer",
        role: UserRole.VIEWER,
        passwordHash,
        phoneNumber: null,
        pushToken: "push-customer-2"
      }
    })
  ]);

  await Promise.all(
    users.map((user, index) =>
      prisma.userPreference.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          emailOptIn: true,
          smsOptIn: index !== 4,
          pushOptIn: true,
          quietHoursStart: user.email === "customer.two@example.com" ? 22 : null,
          quietHoursEnd: user.email === "customer.two@example.com" ? 6 : null
        }
      })
    )
  );

  await prisma.notificationTemplate.upsert({
    where: { name: "Launch Announcement Email" },
    update: {},
    create: {
      name: "Launch Announcement Email",
      channel: NotificationChannel.EMAIL,
      description: "Reusable email template for launches and rollout updates.",
      subjectTemplate: "Update for {{recipientName}}",
      bodyTemplate:
        "Hi {{recipientName}}, {{featureName}} is now live for your account. {{callToAction}}"
    }
  });

  await prisma.notificationTemplate.upsert({
    where: { name: "SMS Reminder" },
    update: {},
    create: {
      name: "SMS Reminder",
      channel: NotificationChannel.SMS,
      description: "Short-form reminder template.",
      bodyTemplate: "Reminder for {{recipientName}}: {{message}}"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
