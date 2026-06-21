import { prisma } from '../lib/prisma.js';
import { createDirectorNotification } from '../utils/notifications.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { logActivity } from '../utils/activityLog.js';

export const getBlacklistRequests = async (req, res) => {
  try {
    const requests = await prisma.blacklistRequest.findMany({
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('getBlacklistRequests xatosi:', error);
    res.status(500).json({ error: "Buyurtmalarni yuklashda xato" });
  }
};

export const createBlacklistRequest = async (req, res) => {
  try {
    const { customerId, type, reason } = req.body;

    const newReq = await prisma.blacklistRequest.create({
      data: {
        customerId: Number(customerId),
        type,
        reason,
        requesterName: req.user.fullName || req.user.username,
        requestedById: req.user.id
      }
    });

    const customer = await prisma.customer.findUnique({
      where: { id: newReq.customerId },
      select: { firstName: true, lastName: true, middleName: true }
    });

    const customerLabel = [customer?.lastName, customer?.firstName, customer?.middleName]
      .filter(Boolean)
      .join(' ') || String(newReq.customerId);

    await logActivity(prisma, {
      actor: req.user,
      action: 'CREATE',
      entityType: 'BlacklistRequest',
      entityId: newReq.id,
      entityLabel: customerLabel,
      toStatus: newReq.status
    });

    res.json(newReq);
  } catch (error) {
    console.error('createBlacklistRequest xatosi:', error);
    res.status(500).json({ error: "Yaratishda xato" });
  }
};

export const updateBlacklistRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    await prisma.blacklistRequest.update({
      where: { id: Number(req.params.id) },
      data: { reason }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('updateBlacklistRequest xatosi:', error);
    res.status(500).json({ error: "Tahrirlashda xatolik yuz berdi" });
  }
};

export const updateBlacklistRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const reqId = Number(req.params.id);

    const request = await prisma.blacklistRequest.findUnique({
      where: { id: reqId }
    });

    if (!request) {
      return res.status(404).json({ error: "Topilmadi" });
    }

    const userRole = String(req.user?.role || '').toLowerCase();
    const userPermissions = Array.isArray(req.user?.permissions)
      ? req.user.permissions
      : [];

    if (
      status === 'Tasdiqlandi' &&
      userRole !== 'director' &&
      !userPermissions.includes(PERMISSIONS.BLACKLIST_APPROVE)
    ) {
      return res.status(403).json({
        error: "Sizda qora ro'yxat so'rovini tasdiqlash huquqi yo'q!"
      });
    }

    const updateData = { status };

    if (status === 'Tasdiqlandi') {
      updateData.approverName = req.user.fullName || req.user.username;
      updateData.approvedById = req.user.id;
      updateData.approvedAt = new Date();
    }

    if (status === 'Bekor qilindi') {
      updateData.cancelledById = req.user.id;
      updateData.cancelledAt = new Date();
    }

    const updatedRequest = await prisma.blacklistRequest.update({
      where: { id: reqId },
      data: updateData
    });

    const customerForLabel = await prisma.customer.findUnique({
      where: { id: request.customerId },
      select: { firstName: true, lastName: true, middleName: true }
    });

    const customerLabel = [
      customerForLabel?.lastName,
      customerForLabel?.firstName,
      customerForLabel?.middleName
    ]
      .filter(Boolean)
      .join(' ') || String(request.customerId);

    if (status === 'Tasdiqlandi') {
      await prisma.customer.update({
        where: { id: request.customerId },
        data: {
          isBlacklisted: request.type === 'ADD'
        }
      });

      await logActivity(prisma, {
        actor: req.user,
        action: 'APPROVE',
        entityType: 'BlacklistRequest',
        entityId: updatedRequest.id,
        entityLabel: customerLabel,
        fromStatus: request.status,
        toStatus: 'Tasdiqlandi'
      });
    }

    if (status === 'Bekor qilindi') {
      await logActivity(prisma, {
        actor: req.user,
        action: 'CANCEL',
        entityType: 'BlacklistRequest',
        entityId: updatedRequest.id,
        entityLabel: customerLabel,
        fromStatus: request.status,
        toStatus: 'Bekor qilindi'
      });
    }

    if (status === 'Yuborildi') {
      const customer = await prisma.customer.findUnique({
        where: { id: request.customerId },
        select: {
          firstName: true,
          lastName: true,
          middleName: true
        }
      });

      const fullName = [
        customer?.lastName,
        customer?.firstName,
        customer?.middleName
      ]
        .filter(Boolean)
        .join(' ');

      await createDirectorNotification({
        type: 'BLACKLIST',
        title:
          request.type === 'ADD'
            ? "Qora ro'yxatga qo'shish so'rovi"
            : "Qora ro'yxatdan chiqarish so'rovi",
        message: `${fullName} bo'yicha yangi so'rov yuborildi. Sabab: ${request.reason}`,
        entityType: 'BLACKLIST_REQUEST',
        entityId: updatedRequest.id,
        status: 'Yuborildi',
        amount: 0
      });

      await logActivity(prisma, {
        actor: req.user,
        action: 'SEND',
        entityType: 'BlacklistRequest',
        entityId: updatedRequest.id,
        entityLabel: fullName || customerLabel,
        fromStatus: request.status,
        toStatus: 'Yuborildi'
      });
    }

    if (status === 'Tasdiqlandi' || status === 'Bekor qilindi') {
      await prisma.notification.updateMany({
        where: {
          entityType: 'BLACKLIST_REQUEST',
          entityId: reqId
        },
        data: {
          status
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('updateBlacklistRequestStatus xatosi:', error);
    res.status(500).json({ error: "Xatolik yuz berdi" });
  }
};

export const deleteBlacklistRequest = async (req, res) => {
  try {
    const reqId = Number(req.params.id);

    const request = await prisma.blacklistRequest.findUnique({
      where: { id: reqId },
      include: {
        customer: {
          select: { firstName: true, lastName: true, middleName: true }
        }
      }
    });

    await prisma.blacklistRequest.delete({
      where: { id: reqId }
    });

    const customerLabel = request
      ? [request.customer?.lastName, request.customer?.firstName, request.customer?.middleName]
          .filter(Boolean)
          .join(' ') || String(request.customerId)
      : String(reqId);

    await logActivity(prisma, {
      actor: req.user,
      action: 'DELETE',
      entityType: 'BlacklistRequest',
      entityId: reqId,
      entityLabel: customerLabel,
      fromStatus: request?.status
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteBlacklistRequest xatosi:', error);
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
};