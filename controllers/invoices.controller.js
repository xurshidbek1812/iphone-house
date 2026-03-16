import { prisma } from '../lib/prisma.js';
import { createDirectorNotification } from '../utils/notifications.js';
import { PERMISSIONS } from '../utils/permissions.js';

const hasApprovePermission = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'director') return true;

  return Array.isArray(user?.permissions)
    && user.permissions.includes(PERMISSIONS.INVOICE_APPROVE);
};

const canManageDraftInvoice = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'director' || hasApprovePermission(user);
};

export const getInvoices = async (req, res) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    console.error('getInvoices xatosi:', error);
    res.status(500).json({ error: "Fakturalarni olishda xatolik" });
  }
};

export const createInvoice = async (req, res) => {
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

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Faktura uchun kamida 1 ta tovar bo'lishi kerak!"
      });
    }

    const newInvoice = await prisma.supplierInvoice.create({
      data: {
        date: new Date(date),
        supplierName: supplier,
        invoiceNumber: String(invoiceNumber),
        exchangeRate: Number(exchangeRate || 0),
        totalSum: Number(totalSum || 0),
        status: status || 'Jarayonda',
        userName,
        items: {
          create: items.map((item) => ({
            productId: Number(item.id || item.productId),
            customId: Number(item.customId || 0),
            name: item.name,
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

    res.json(newInvoice);
  } catch (error) {
    console.error('createInvoice xatosi:', error);
    res.status(500).json({ error: "Faktura saqlashda xatolik" });
  }
};

export const updateInvoice = async (req, res) => {
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

    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          date: new Date(date),
          supplierName: supplier,
          invoiceNumber: String(invoiceNumber),
          exchangeRate: Number(exchangeRate || 0),
          totalSum: Number(totalSum || 0),
          status
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
          name: item.name,
          count: Number(item.count || 0),
          price: Number(item.price || 0),
          salePrice: Number(item.salePrice || 0),
          currency: item.currency || 'UZS',
          markup: Number(item.markup || 0),
          total: Number(item.total || 0)
        }))
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('updateInvoice xatosi:', error);
    res.status(500).json({ error: "Tahrirlashda xatolik yuz berdi" });
  }
};

export const updateInvoiceStatus = async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const { status } = req.body;

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Faktura topilmadi" });
    }

    if (status === 'Tasdiqlandi' && !hasApprovePermission(req.user)) {
      return res.status(403).json({
        error: "Sizda kirim fakturasini tasdiqlash huquqi yo'q!"
      });
    }

    if (status === 'Yuborildi' && !canManageDraftInvoice(req.user)) {
      return res.status(403).json({
        error: "Sizda fakturani yuborish huquqi yo'q!"
      });
    }

    const updatedInvoice = await prisma.supplierInvoice.update({
      where: { id: invoiceId },
      data: { status }
    });

    if (status === 'Yuborildi') {
      await createDirectorNotification({
        type: 'INVOICE',
        title: `Kirim faktura yuborildi: ${invoice.invoiceNumber}`,
        message: `${invoice.supplierName || "Noma'lum ta'minotchi"} bo'yicha faktura direktorga yuborildi`,
        entityType: 'SUPPLIER_INVOICE',
        entityId: updatedInvoice.id,
        status: 'Yuborildi',
        amount: Number(invoice.totalSum || 0)
      });
    }

    if (status === 'Tasdiqlandi' || status === 'Bekor qilindi') {
      await prisma.notification.updateMany({
        where: {
          entityType: 'SUPPLIER_INVOICE',
          entityId: invoiceId
        },
        data: {
          status
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('updateInvoiceStatus xatosi:', error);
    res.status(500).json({ error: "Holatni o'zgartirishda xatolik" });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Faktura topilmadi!' });
    }

    const isDirector = String(req.user?.role || '').toLowerCase() === 'director';
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