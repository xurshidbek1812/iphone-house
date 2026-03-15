import { prisma } from '../lib/prisma.js';
import { createDirectorNotification } from '../utils/notifications.js';
import { PERMISSIONS } from '../utils/permissions.js';

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

    const newInvoice = await prisma.supplierInvoice.create({
      data: {
        date: new Date(date),
        supplierName: supplier,
        invoiceNumber,
        exchangeRate: Number(exchangeRate),
        totalSum: Number(totalSum),
        status: status || 'Jarayonda',
        userName,
        items: {
          create: items.map((item) => ({
            productId: item.id,
            customId: Number(item.customId),
            name: item.name,
            count: Number(item.count),
            price: Number(item.price),
            salePrice: Number(item.salePrice),
            currency: item.currency,
            markup: Number(item.markup || 0),
            total: Number(item.total)
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

    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          date: new Date(date),
          supplierName: supplier,
          invoiceNumber,
          exchangeRate: Number(exchangeRate),
          totalSum: Number(totalSum),
          status
        }
      });

      await tx.supplierInvoiceItem.deleteMany({
        where: { supplierInvoiceId: invoiceId }
      });

      await tx.supplierInvoiceItem.createMany({
        data: items.map((item) => ({
          supplierInvoiceId: invoiceId,
          productId: item.id || item.productId,
          customId: Number(item.customId),
          name: item.name,
          count: Number(item.count),
          price: Number(item.price),
          salePrice: Number(item.salePrice),
          currency: item.currency,
          markup: Number(item.markup || 0),
          total: Number(item.total)
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

    const userRole = String(req.user?.role || '').toLowerCase();
    const userPermissions = Array.isArray(req.user?.permissions)
      ? req.user.permissions
      : [];

    if (
      status === 'Tasdiqlandi' &&
      userRole !== 'director' &&
      !userPermissions.includes(PERMISSIONS.INVOICE_APPROVE)
    ) {
      return res.status(403).json({
        error: "Sizda kirim fakturasini tasdiqlash huquqi yo'q!"
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
    await prisma.supplierInvoice.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteInvoice xatosi:', error);
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
};