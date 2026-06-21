import { prisma } from '../lib/prisma.js';

export const getActivityLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const entityType = String(req.query.entityType || 'ALL').trim();
    const action = String(req.query.action || 'ALL').trim();
    const actorId = req.query.actorId ? Number(req.query.actorId) : null;
    const search = String(req.query.search || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

    const where = {
      ...(entityType !== 'ALL' ? { entityType } : {}),
      ...(action !== 'ALL' ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {})
            }
          }
        : {}),
      ...(search
        ? {
            OR: [
              { actorName: { contains: search, mode: 'insensitive' } },
              { entityLabel: { contains: search, mode: 'insensitive' } },
              { note: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [total, items] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error) {
    console.error('getActivityLogs xatosi:', error);
    return res.status(500).json({ error: "Faoliyat tarixini olishda xatolik" });
  }
};

export const getActivityEntityTypes = async (req, res) => {
  try {
    const rows = await prisma.activityLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' }
    });

    return res.json(rows.map((r) => r.entityType));
  } catch (error) {
    console.error('getActivityEntityTypes xatosi:', error);
    return res.status(500).json({ error: "Ma'lumotni olishda xatolik" });
  }
};

export const getActivityActors = async (req, res) => {
  try {
    const rows = await prisma.activityLog.findMany({
      where: { actorId: { not: null } },
      distinct: ['actorId'],
      select: { actorId: true, actorName: true },
      orderBy: { actorName: 'asc' }
    });

    return res.json(rows.map((r) => ({ id: r.actorId, name: r.actorName })));
  } catch (error) {
    console.error('getActivityActors xatosi:', error);
    return res.status(500).json({ error: "Ma'lumotni olishda xatolik" });
  }
};
