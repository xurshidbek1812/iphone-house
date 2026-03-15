import { prisma } from '../lib/prisma.js';

export const createDirectorNotification = async ({
  type,
  title,
  message = null,
  entityType = null,
  entityId = null,
  status = null,
  amount = 0
}) => {
  const directors = await prisma.user.findMany({
    where: {
      role: {
        in: ['director', 'DIRECTOR']
      }
    },
    select: {
      id: true
    }
  });

  if (!directors.length) return;

  await prisma.notification.createMany({
    data: directors.map((director) => ({
      userId: director.id,
      type,
      title,
      message,
      entityType,
      entityId,
      status,
      amount
    }))
  });
};

export const markNotificationAsRead = async (notificationId, userId) => {
  return prisma.notification.updateMany({
    where: {
      id: Number(notificationId),
      userId: Number(userId)
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });
};

export const markAllNotificationsAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: {
      userId: Number(userId),
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });
};
