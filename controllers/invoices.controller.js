import { prisma } from '../lib/prisma.js';
import { createDirectorNotification } from '../utils/notifications.js';
import { PERMISSIONS } from '../utils/permissions.js';

const ALLOWED_STATUSES = ['Jarayonda', 'Yuborildi', 'Tasdiqlandi', 'Bekor qilindi'];

const hasApprovePermission = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'director') return true;

  return Array.isArray(user?.permissions) &&
    user.permissions.includes(PERMISSIONS.INVOICE_APPROVE);
};

const canManageDraftInvoice = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'director' || hasApprovePermission(user);
};

const canEditInvoice = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'director' || hasApprovePermission(user);
};

const validateInvoiceItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "Faktura uchun kamida 1 ta tovar bo'lishi kerak!";
  }

  for (const item of items) {
    const productId = Number(item.id || item.productId);
    const count = Number(item.count || 0);
    const price = Number(item.price || 0);
    const salePrice = Number(item.salePrice || 0);

    if (!productId || Number.isNaN(productId)) {
      return "Mahsulot ID noto'g'ri!";
    }

    if (!count || Number.isNaN(count) || count <= 0) {
      return "Mahsulot soni noto'g'ri!";
    }

    if (Number.isNaN(price) || price < 0) {
      return "Kirim narxi noto'g'ri!";
    }

    if (Number.isNaN(salePrice) || salePrice < 0) {
      return "Sotuv narxi noto'g'ri!";
    }
  }

  return null;
};

export const getInvoices = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'ALL').trim();

    const where = {
      ...(status !== 'ALL' ? { status } : {}),
      ...(search
        ? {
            OR: [
              {
                supplierName: {
                  contains: search,
                  mode: 'insensitive'
                }
              },
              {
                invoiceNumber: {
                  contains: search,
                  mode: 'insensitive'
                }
              },
              {
                userName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            ]
          }
        : {})
    };

    const [total, invoices] = await Promise.all([
      prisma.supplierInvoice.count({ where }),
      prisma.supplierInvoice.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    return res.json({
      items: invoices,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('getInvoices xatosi:', error);
    return res.status(500).json({ error: "Fakturalarni olishda xatolik" });
  }
};

export const createInvoice = async (req, res) => {
  if (!canManageDraftInvoice(req.user)) {
    return res.status(403).json({
      error: "Sizda faktura yaratish huquqi yo'q!"
    });
  }

  try {
    const {
      date,
      supplier,
      invoiceNumber,
      exchangeRate,
      totalSum,
      status,
      userName,
      items
    } = req.body;

    if (!supplier || !String(supplier).trim()) {
      return res.status(400).json({
        error: "Ta'minotchi ko'rsatilishi shart!"
      });
    }

    if (!invoiceNumber || !String(invoiceNumber).trim()) {
      return res.status(400).json({
        error: "Faktura raqami kiritilishi shart!"
      });
    }

    const itemsError = validateInvoiceItems(items);
    if (itemsError) {
      return res.status(400).json({ error: itemsError });
    }

    const safeStatus = ALLOWED_STATUSES.includes(status) ? status : 'Jarayonda';

    if (safeStatus !== 'Jarayonda' && safeStatus !== 'Yuborildi') {
      return res.status(400).json({
        error: "Yangi faktura faqat 'Jarayonda' yoki 'Yuborildi' holatida yaratilishi mumkin!"
      });
    }

    const newInvoice = await prisma.supplierInvoice.create({
      data: {
        date: date ? new Date(date) : new Date(),
        supplierName: String(supplier).trim(),
        invoiceNumber: String(invoiceNumber).trim(),
        exchangeRate: Number(exchangeRate || 0),
        totalSum: Number(totalSum || 0),
        status: safeStatus,
        userName: userName || req.user?.fullName || req.user?.username || 'Noma’lum',
        items: {
          create: items.map((item) => ({
            productId: Number(item.id || item.productId),
            customId: Number(item.customId || 0),
            name: String(item.name || '').trim(),
            count: Number(item.count || 0),
            price: Number(item.price || 0),
            salePrice: Number(item.salePrice || 0),
            currency: item.currency || 'UZS',
            markup: Number(item.markup || 0),
            total: Number(item.total || 0)
          }))
        }
      },
      include: { items: true }
    });

    if (safeStatus === 'Yuborildi') {
      await createDirectorNotification({
        type: 'INVOICE',
        title: `Kirim faktura yuborildi: ${newInvoice.invoiceNumber}`,
        message: `${newInvoice.supplierName || "Noma'lum ta'minotchi"} bo'yicha faktura direktorga yuborildi`,
        entityType: 'SUPPLIER_INVOICE',
        entityId: newInvoice.id,
        status: 'Yuborildi',
        amount: Number(newInvoice.totalSum || 0)
      });
    }

    return res.json(newInvoice);
  } catch (error) {
    console.error('createInvoice xatosi:', error);
    return res.status(500).json({ error: "Faktura saqlashda xatolik" });
  }
};

export const updateInvoice = async (req, res) => {
  if (!canEditInvoice(req.user)) {
    return res.status(403).json({
      error: "Sizda fakturani tahrirlash huquqi yo'q!"
    });
  }

  try {
    const {
      date,
      supplier,
      invoiceNumber,
      exchangeRate,
      totalSum,
      status,
      items
    } = req.body;

    const invoiceId = Number(req.params.id);

    if (!invoiceId) {
      return res.status(400).json({ error: "Faktura ID noto'g'ri!" });
    }

    const existingInvoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Faktura topilmadi!' });
    }

    if (existingInvoice.status === 'Tasdiqlandi') {
      return res.status(400).json({
        error: "Tasdiqlangan fakturani tahrirlab bo'lmaydi!"
      });
    }

    if (!supplier || !String(supplier).trim()) {
      return res.status(400).json({
        error: "Ta'minotchi ko'rsatilishi shart!"
      });
    }

    if (!invoiceNumber || !String(invoiceNumber).trim()) {
      return res.status(400).json({
        error: "Faktura raqami kiritilishi shart!"
      });
    }

    const itemsError = validateInvoiceItems(items);
    if (itemsError) {
      return res.status(400).json({ error: itemsError });
    }

    const safeStatus = ALLOWED_STATUSES.includes(status)
      ? status
      : existingInvoice.status;

    if (safeStatus === 'Tasdiqlandi') {
      return res.status(400).json({
        error: "Tasdiqlash alohida jarayon orqali amalga oshiriladi!"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          date: date ? new Date(date) : existingInvoice.date,
          supplierName: String(supplier).trim(),
          invoiceNumber: String(invoiceNumber).trim(),
          exchangeRate: Number(exchangeRate || 0),
          totalSum: Number(totalSum || 0),
          status: safeStatus
        }
      });

      await tx.supplierInvoiceItem.deleteMany({
        where: { supplierInvoiceId: invoiceId }
      });

      await tx.supplierInvoiceItem.createMany({
        data: items.map((item) => ({
          supplierInvoiceId: invoiceId,
          productId: Number(item.id || item.productId),
          customId: Number(item.customId || 0),
          name: String(item.name || '').trim(),
          count: Number(item.count || 0),
          price: Number(item.price || 0),
          salePrice: Number(item.salePrice || 0),
          currency: item.currency || 'UZS',
          markup: Number(item.markup || 0),
          total: Number(item.total || 0)
        }))
      });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('updateInvoice xatosi:', error);
    return res.status(500).json({ error: "Tahrirlashda xatolik yuz berdi" });
  }
};

export const updateInvoiceStatus = async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const { status } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: "Faktura ID noto'g'ri!" });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Noto'g'ri status yuborildi!"
      });
    }

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Faktura topilmadi" });
    }

    if (invoice.status === status) {
      return res.status(400).json({
        error: `Faktura allaqachon '${status}' holatida!`
      });
    }

    if (invoice.status === 'Tasdiqlandi') {
      return res.status(400).json({
        error: "Tasdiqlangan fakturaning holatini o'zgartirib bo'lmaydi!"
      });
    }

    if (status === 'Yuborildi') {
      if (!canManageDraftInvoice(req.user)) {
        return res.status(403).json({
          error: "Sizda fakturani yuborish huquqi yo'q!"
        });
      }

      const updatedInvoice = await prisma.supplierInvoice.update({
        where: { id: invoiceId },
        data: { status: 'Yuborildi' }
      });

      await createDirectorNotification({
        type: 'INVOICE',
        title: `Kirim faktura yuborildi: ${invoice.invoiceNumber}`,
        message: `${invoice.supplierName || "Noma'lum ta'minotchi"} bo'yicha faktura direktorga yuborildi`,
        entityType: 'SUPPLIER_INVOICE',
        entityId: updatedInvoice.id,
        status: 'Yuborildi',
        amount: Number(invoice.totalSum || 0)
      });

      return res.json({ success: true });
    }

    if (status === 'Bekor qilindi') {
      if (!canManageDraftInvoice(req.user)) {
        return res.status(403).json({
          error: "Sizda fakturani bekor qilish huquqi yo'q!"
        });
      }

      await prisma.supplierInvoice.update({
        where: { id: invoiceId },
        data: { status: 'Bekor qilindi' }
      });

      await prisma.notification.updateMany({
        where: {
          entityType: 'SUPPLIER_INVOICE',
          entityId: invoiceId
        },
        data: {
          status: 'Bekor qilindi'
        }
      });

      return res.json({ success: true });
    }

    if (status === 'Tasdiqlandi') {
      if (!hasApprovePermission(req.user)) {
        return res.status(403).json({
          error: "Sizda kirim fakturasini tasdiqlash huquqi yo'q!"
        });
      }

      if (!['Jarayonda', 'Yuborildi'].includes(invoice.status)) {
        return res.status(400).json({
          error: "Bu fakturani tasdiqlab bo'lmaydi!"
        });
      }

      if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
        return res.status(400).json({
          error: "Fakturadagi tovarlar topilmadi!"
        });
      }

      await prisma.$transaction(async (tx) => {
        for (const item of invoice.items) {
          const productId = Number(item.productId);
          const addedQty = Number(item.count || 0);
          const buyPrice = Number(item.price || 0);
          const salePrice = Number(item.salePrice || 0);
          const currency = item.currency || 'UZS';

          if (!productId || addedQty <= 0) {
            throw new Error("Faktura ichidagi mahsulot ma'lumoti noto'g'ri!");
          }

          const currentProduct = await tx.product.findUnique({
            where: { id: productId }
          });

          if (!currentProduct) {
            throw new Error(`Mahsulot topilmadi. Product ID: ${productId}`);
          }

          await tx.productBatch.create({
            data: {
              productId,
              supplierInvoiceId: invoice.id,
              supplierInvoiceItemId: item.id,
              initialQty: addedQty,
              quantity: addedQty,
              buyPrice,
              salePrice,
              buyCurrency: currency,
              supplierName: invoice.supplierName || null,
              invoiceNumber: invoice.invoiceNumber ? String(invoice.invoiceNumber) : null
            }
          });

          await tx.product.update({
            where: { id: productId },
            data: {
              quantity: { increment: addedQty },
              buyPrice,
              salePrice,
              buyCurrency: currency
            }
          });
        }

        await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: { status: 'Tasdiqlandi' }
        });

        await tx.notification.updateMany({
          where: {
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId
          },
          data: {
            status: 'Tasdiqlandi'
          }
        });
      });

      return res.json({ success: true });
    }

    return res.status(400).json({
      error: "Qo'llab-quvvatlanmaydigan status!"
    });
  } catch (error) {
    console.error('updateInvoiceStatus xatosi:', error);
    return res.status(500).json({
      error: error.message || "Holatni o'zgartirishda xatolik"
    });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);

    if (!invoiceId) {
      return res.status(400).json({ error: "Faktura ID noto'g'ri!" });
    }

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Faktura topilmadi!' });
    }

    const canApprove = hasApprovePermission(req.user);
    const canDraft = canManageDraftInvoice(req.user);

    if (invoice.status === 'Jarayonda' && !canDraft) {
      return res.status(403).json({
        error: "Sizda bu fakturani o'chirish huquqi yo'q!"
      });
    }

    if (invoice.status === 'Yuborildi' && !canApprove) {
      return res.status(403).json({
        error: "Jo'natilgan fakturani faqat direktor yoki tasdiqlovchi o'chira oladi!"
      });
    }

    if (invoice.status === 'Tasdiqlandi' && !canApprove) {
      return res.status(403).json({
        error: "Tasdiqlangan fakturani faqat direktor yoki tasdiqlovchi o'chira oladi!"
      });
    }

    await prisma.$transaction(async (tx) => {
      if (invoice.status === 'Tasdiqlandi') {
        const relatedBatches = await tx.productBatch.findMany({
          where: {
            supplierInvoiceId: invoice.id
          }
        });

        if (!relatedBatches.length) {
          throw new Error(
            "Bu fakturaga bog'langan ombor partiyalari topilmadi. Eski kirim bo'lishi mumkin."
          );
        }

        for (const batch of relatedBatches) {
          if (Number(batch.quantity) < Number(batch.initialQty)) {
            throw new Error(
              "Bu fakturani o'chirib bo'lmaydi. Kirimdagi tovarlarning bir qismi allaqachon ishlatilgan."
            );
          }
        }

        for (const batch of relatedBatches) {
          await tx.product.update({
            where: { id: batch.productId },
            data: {
              quantity: {
                decrement: Number(batch.initialQty)
              }
            }
          });

          await tx.productBatch.delete({
            where: { id: batch.id }
          });
        }
      }

      await tx.notification.deleteMany({
        where: {
          entityType: 'SUPPLIER_INVOICE',
          entityId: invoice.id
        }
      });

      await tx.supplierInvoiceItem.deleteMany({
        where: { supplierInvoiceId: invoice.id }
      });

      await tx.supplierInvoice.delete({
        where: { id: invoice.id }
      });
    });

    return res.json({
      success: true,
      message:
        invoice.status === 'Tasdiqlandi'
          ? "Tasdiqlangan faktura o'chirildi va kirim ombordan qaytarildi!"
          : "Faktura o'chirildi!"
    });
  } catch (error) {
    console.error('deleteInvoice xatosi:', error);
    return res.status(400).json({
      error: error.message || "Fakturani o'chirishda xatolik yuz berdi"
    });
  }
};