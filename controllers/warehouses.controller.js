import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { logActivity } from '../utils/activityLog.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getWarehouses = async (req, res) => {
  try {
    const onlyActive = String(req.query.active || '').toLowerCase() === 'true';

    const warehouses = await prisma.warehouse.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { id: 'asc' }
    });

    const summaries = await prisma.productBatch.groupBy({
      by: ['warehouseId', 'productId'],
      where: { isArchived: false, quantity: { gt: 0 } },
      _sum: { quantity: true }
    });

    const statsByWarehouse = new Map();
    for (const row of summaries) {
      const stats = statsByWarehouse.get(row.warehouseId) || { productCount: 0, totalQuantity: 0 };
      stats.productCount += 1;
      stats.totalQuantity += Number(row._sum.quantity || 0);
      statsByWarehouse.set(row.warehouseId, stats);
    }

    const result = warehouses.map((w) => ({
      ...w,
      productCount: statsByWarehouse.get(w.id)?.productCount || 0,
      totalQuantity: statsByWarehouse.get(w.id)?.totalQuantity || 0
    }));

    res.json(result);
  } catch (error) {
    console.error('getWarehouses xatosi:', error);
    res.status(500).json({ error: "Omborlarni yuklashda xatolik yuz berdi" });
  }
};

export const createWarehouse = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.WAREHOUSE_MANAGE)) {
    return res.status(403).json({ error: "Sizda omborlarni boshqarish huquqi yo'q!" });
  }

  try {
    const { name, address } = req.body;
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return res.status(400).json({ error: "Ombor nomi kiritilishi shart!" });
    }

    const existing = await prisma.warehouse.findUnique({ where: { name: cleanName } });
    if (existing) {
      return res.status(400).json({ error: "Shu nomdagi ombor allaqachon mavjud!" });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: cleanName,
        address: address ? String(address).trim() : null
      }
    });

    await logActivity(prisma, {
      actor: req.user,
      action: 'CREATE',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      entityLabel: warehouse.name
    });

    res.json(warehouse);
  } catch (error) {
    console.error('createWarehouse xatosi:', error);
    res.status(500).json({ error: "Ombor yaratishda xatolik yuz berdi" });
  }
};

export const updateWarehouse = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.WAREHOUSE_MANAGE)) {
    return res.status(403).json({ error: "Sizda omborlarni boshqarish huquqi yo'q!" });
  }

  try {
    const warehouseId = Number(req.params.id);
    const { name, address, isActive } = req.body;

    const existing = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!existing) {
      return res.status(404).json({ error: "Ombor topilmadi!" });
    }

    const data = {};

    if (name !== undefined) {
      const cleanName = String(name || '').trim();
      if (!cleanName) {
        return res.status(400).json({ error: "Ombor nomi bo'sh bo'lmasligi kerak!" });
      }

      if (cleanName !== existing.name) {
        const nameTaken = await prisma.warehouse.findUnique({ where: { name: cleanName } });
        if (nameTaken) {
          return res.status(400).json({ error: "Shu nomdagi ombor allaqachon mavjud!" });
        }
      }

      data.name = cleanName;
    }

    if (address !== undefined) {
      data.address = address ? String(address).trim() : null;
    }

    if (isActive !== undefined) {
      if (isActive === false && existing.name === 'Asosiy') {
        return res.status(400).json({ error: "Asosiy omborni o'chirib bo'lmaydi!" });
      }
      data.isActive = Boolean(isActive);
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data
    });

    await logActivity(prisma, {
      actor: req.user,
      action: 'UPDATE',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      entityLabel: warehouse.name
    });

    res.json(warehouse);
  } catch (error) {
    console.error('updateWarehouse xatosi:', error);
    res.status(500).json({ error: "Omborni yangilashda xatolik yuz berdi" });
  }
};

export const transferStock = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.WAREHOUSE_MANAGE)) {
    return res.status(403).json({ error: "Sizda omborlar orasida o'tkazma qilish huquqi yo'q!" });
  }

  try {
    const { productId, fromWarehouseId, toWarehouseId, quantity, imeis, note } = req.body;

    const prodId = Number(productId);
    const fromId = Number(fromWarehouseId);
    const toId = Number(toWarehouseId);
    const rawImeis = Array.isArray(imeis)
      ? imeis.map((imei) => String(imei || '').trim()).filter(Boolean)
      : [];

    if (!prodId || !fromId || !toId) {
      return res.status(400).json({
        error: "Mahsulot va omborlar tanlanishi shart!"
      });
    }

    if (fromId === toId) {
      return res.status(400).json({ error: "Bir xil ombor orasida o'tkazma qilib bo'lmaydi!" });
    }

    const isImeiTransfer = rawImeis.length > 0;
    const requestedQty = isImeiTransfer ? rawImeis.length : Number(quantity);

    if (!isImeiTransfer && (!requestedQty || requestedQty <= 0)) {
      return res.status(400).json({ error: "O'tkaziladigan miqdor noto'g'ri!" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromWarehouse = await tx.warehouse.findUnique({ where: { id: fromId } });
      const toWarehouse = await tx.warehouse.findUnique({ where: { id: toId } });

      if (!fromWarehouse || !toWarehouse) {
        throw new Error("Omborlardan biri topilmadi!");
      }

      if (!fromWarehouse.isActive || !toWarehouse.isActive) {
        throw new Error("Yopilgan ombor bilan o'tkazma qilib bo'lmaydi!");
      }

      const product = await tx.product.findUnique({ where: { id: prodId } });
      if (!product) {
        throw new Error("Mahsulot topilmadi!");
      }

      // Manba batchlardan qaysi biri qancha qatlam (chunk) berishini aniqlaymiz
      const chunks = [];

      if (isImeiTransfer) {
        const units = await tx.productUnit.findMany({
          where: { imei: { in: rawImeis } },
          include: { batch: true }
        });

        const notFound = rawImeis.filter((imei) => !units.some((u) => u.imei === imei));
        if (notFound.length > 0) {
          throw new Error(`Quyidagi IMEI raqamlar topilmadi: ${notFound.join(', ')}`);
        }

        const notInStock = units.filter((u) => u.status !== 'IN_STOCK');
        if (notInStock.length > 0) {
          throw new Error(
            `Quyidagi IMEI raqamlar band yoki sotilgan: ${notInStock.map((u) => u.imei).join(', ')}`
          );
        }

        const wrongWarehouse = units.filter((u) => u.batch.warehouseId !== fromId);
        if (wrongWarehouse.length > 0) {
          throw new Error(
            `Quyidagi IMEI raqamlar tanlangan omborga tegishli emas: ${wrongWarehouse.map((u) => u.imei).join(', ')}`
          );
        }

        const unitsByBatch = new Map();
        for (const unit of units) {
          const list = unitsByBatch.get(unit.batchId) || [];
          list.push(unit);
          unitsByBatch.set(unit.batchId, list);
        }

        for (const [batchId, batchUnits] of unitsByBatch) {
          const sourceBatch = batchUnits[0].batch;
          chunks.push({
            sourceBatch,
            quantity: batchUnits.length,
            unitIds: batchUnits.map((u) => u.id)
          });
        }
      } else {
        const sourceBatches = await tx.productBatch.findMany({
          where: {
            productId: prodId,
            warehouseId: fromId,
            isArchived: false,
            quantity: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        });

        let remaining = requestedQty;

        for (const batch of sourceBatches) {
          if (remaining <= 0) break;

          const available = Number(batch.quantity);
          if (available <= 0) continue;

          const taken = Math.min(available, remaining);
          chunks.push({ sourceBatch: batch, quantity: taken, unitIds: [] });
          remaining -= taken;
        }

        if (remaining > 0) {
          throw new Error(`${product.name} uchun tanlangan omborda yetarli qoldiq yo'q!`);
        }
      }

      for (const chunk of chunks) {
        await tx.productBatch.update({
          where: { id: chunk.sourceBatch.id },
          data: { quantity: { decrement: chunk.quantity } }
        });

        const destBatch = await tx.productBatch.create({
          data: {
            productId: prodId,
            warehouseId: toId,
            initialQty: chunk.quantity,
            quantity: chunk.quantity,
            buyPrice: chunk.sourceBatch.buyPrice,
            salePrice: chunk.sourceBatch.salePrice,
            buyCurrency: chunk.sourceBatch.buyCurrency,
            supplierName: chunk.sourceBatch.supplierName,
            invoiceNumber: chunk.sourceBatch.invoiceNumber,
            note: note ? String(note).trim() : null
          }
        });

        if (chunk.unitIds.length > 0) {
          await tx.productUnit.updateMany({
            where: { id: { in: chunk.unitIds } },
            data: { batchId: destBatch.id }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: prodId,
            batchId: chunk.sourceBatch.id,
            type: 'TRANSFER_OUT',
            quantity: chunk.quantity,
            unitCost: chunk.sourceBatch.buyPrice,
            unitPrice: chunk.sourceBatch.salePrice,
            sourceType: 'TRANSFER',
            note: `${toWarehouse.name} omboriga o'tkazma`,
            userId: req.user.id
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: prodId,
            batchId: destBatch.id,
            type: 'TRANSFER_IN',
            quantity: chunk.quantity,
            unitCost: chunk.sourceBatch.buyPrice,
            unitPrice: chunk.sourceBatch.salePrice,
            sourceType: 'TRANSFER',
            note: `${fromWarehouse.name} omboridan o'tkazma`,
            userId: req.user.id
          }
        });
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          productId: prodId,
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          quantity: requestedQty,
          imeis: isImeiTransfer ? rawImeis : null,
          note: note ? String(note).trim() : null,
          userId: req.user.id
        }
      });

      await logActivity(tx, {
        actor: req.user,
        action: 'TRANSFER',
        entityType: 'StockTransfer',
        entityId: transfer.id,
        entityLabel: `${product.name}: ${fromWarehouse.name} -> ${toWarehouse.name} (${requestedQty} ta)`
      });

      return transfer;
    }, { maxWait: 10000, timeout: 20000 });

    res.json({ success: true, transfer: result });
  } catch (error) {
    console.error('transferStock xatosi:', error);
    const safeMessage = error?.message || "O'tkazma qilishda xatolik yuz berdi";
    res.status(400).json({ error: safeMessage });
  }
};

export const getStockTransfers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const [total, transfers] = await Promise.all([
      prisma.stockTransfer.count(),
      prisma.stockTransfer.findMany({
        include: {
          product: { select: { id: true, name: true, customId: true } },
          fromWarehouse: true,
          toWarehouse: true,
          user: { select: { id: true, fullName: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    res.json({
      items: transfers,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('getStockTransfers xatosi:', error);
    res.status(500).json({ error: "O'tkazmalar tarixini yuklashda xatolik yuz berdi" });
  }
};
