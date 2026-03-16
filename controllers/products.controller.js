import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';

const normalizeProductName = (value) => {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        batches: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Tovarlarni olishda xatolik yuz berdi" });
  }
};

export const createProduct = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.PRODUCT_MANAGE)) {
    return res.status(403).json({
      error: "Sizda mahsulot qo'shish huquqi yo'q!"
    });
  }

  try {
    const {
      customId,
      name,
      category,
      buyPrice,
      salePrice,
      quantity,
      unit,
      buyCurrency,
      saleCurrency
    } = req.body;

    if (!name || !customId || !category) {
      return res.status(400).json({
        error: "Majburiy maydonlar to'ldirilmadi!"
      });
    }

    if (isNaN(Number(buyPrice)) || isNaN(Number(salePrice))) {
      return res.status(400).json({
        error: "Narxlar faqat raqam bo'lishi shart!"
      });
    }

    const normalizedName = normalizeProductName(name);
    const initialQty = Number(quantity) || 0;

    const product = await prisma.$transaction(async (tx) => {
      const newProd = await tx.product.create({
        data: {
          customId: Number(customId),
          name: name.trim(),
          normalizedName,
          category,
          buyPrice: Number(buyPrice),
          salePrice: Number(salePrice),
          quantity: initialQty,
          unit,
          buyCurrency,
          saleCurrency
        }
      });

      if (initialQty > 0) {
        await tx.productBatch.create({
          data: {
            productId: newProd.id,
            initialQty,
            quantity: initialQty,
            buyPrice: Number(buyPrice),
            salePrice: Number(salePrice),
            buyCurrency
          }
        });
      }

      return newProd;
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Tovar qo'shish xatosi:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: "Bu nomdagi tovar bazada allaqachon mavjud!"
      });
    }

    res.status(500).json({ error: "Tovar qo'shishda xatolik yuz berdi" });
  }
};

export const updateProduct = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.PRODUCT_MANAGE)) {
    return res.status(403).json({
      error: "Sizda mahsulotni tahrirlash huquqi yo'q!"
    });
  }

  try {
    const productId = Number(req.params.id);
    const { name, category, unit, buyPrice, salePrice } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Tovar nomi bo'sh bo'lishi mumkin emas!"
      });
    }

    const normalizedName = normalizeProductName(name);

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        name: name.trim(),
        normalizedName,
        category,
        unit,
        buyPrice: Number(buyPrice),
        salePrice: Number(salePrice)
      }
    });

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("Tovarni tahrirlashda xatolik:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: "Siz o'zgartirgan nomni boshqa tovar band qilgan!"
      });
    }

    res.status(500).json({ error: "Tovarni tahrirlashda xatolik yuz berdi" });
  }
};

export const deleteProduct = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.PRODUCT_MANAGE)) {
    return res.status(403).json({
      error: "Sizda mahsulotni o'chirish huquqi yo'q!"
    });
  }

  try {
    await prisma.product.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
};

export const archiveProductBatch = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.PRODUCT_MANAGE)) {
    return res.status(403).json({
      error: "Sizda partiyani yashirish huquqi yo'q!"
    });
  }

  try {
    const batchId = Number(req.params.id);

    await prisma.productBatch.update({
      where: { id: batchId },
      data: { isArchived: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Arxivlashda xato:", error);
    res.status(500).json({ error: "Partiyani yashirishda xatolik" });
  }
};

export const increaseProductStock = async (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Qo'shish uchun tovarlar ro'yxati kiritilmadi!"
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const addedQty = Number(item.quantity || item.count || item.inputQty);
        const productId = Number(item.id);

        if (isNaN(addedQty) || addedQty <= 0) {
          throw new Error(`Xato: Tovar soni noto'g'ri kiritildi (0 dan katta bo'lishi shart)!`);
        }

        const currentProduct = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!currentProduct) {
          throw new Error(`Xato: Bazada ID: ${productId} bo'lgan tovar topilmadi!`);
        }

        const price = Number(
          item.buyPrice || item.price || item.inputPrice || currentProduct.buyPrice
        );

        const salePrice = Number(
          item.salePrice || item.inputSalePrice || currentProduct.salePrice
        );

        if (isNaN(price) || price < 0 || isNaN(salePrice) || salePrice < 0) {
          throw new Error(`Xato: ${currentProduct.name} tovarining narxlari noto'g'ri kiritildi!`);
        }

        const currency =
          item.buyCurrency ||
          item.currency ||
          item.inputCurrency ||
          currentProduct.buyCurrency ||
          'UZS';

        await tx.productBatch.create({
          data: {
            productId,
            supplierId: item.supplierId ? Number(item.supplierId) : null,
            supplierInvoiceId: item.supplierInvoiceId ? Number(item.supplierInvoiceId) : null,
            supplierInvoiceItemId: item.supplierInvoiceItemId ? Number(item.supplierInvoiceItemId) : null,
            initialQty: addedQty,
            quantity: addedQty,
            buyPrice: price,
            salePrice,
            buyCurrency: currency,
            supplierName: item.supplierName || null,
            invoiceNumber: item.invoiceNumber ? String(item.invoiceNumber) : null
          }
        });

        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { increment: addedQty },
            buyPrice: price,
            salePrice,
            buyCurrency: currency
          }
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ OMBOR KIRIM XATOSI:", error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Ombor yangilanmadi" });
  }
};

export const decreaseProductStock = async (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Kamaytirish uchun tovarlar ro'yxati kiritilmadi!"
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const qtyToDecrease = Number(item.inputQty);
        const productId = Number(item.id);

        if (isNaN(qtyToDecrease) || qtyToDecrease <= 0) {
          throw new Error(`Xato: Tovar soni noto'g'ri kiritildi (0 dan katta bo'lishi shart)!`);
        }

        const currentProduct = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!currentProduct) {
          throw new Error(`Xato: Bazada ID: ${productId} bo'lgan tovar topilmadi!`);
        }

        if (currentProduct.quantity < qtyToDecrease) {
          throw new Error(`Xato: ${currentProduct.name} tovaridan omborda yetarli qoldiq yo'q!`);
        }

        if (item.batchId && !String(item.batchId).startsWith('old-')) {
          const batchId = Number(item.batchId);

          const currentBatch = await tx.productBatch.findUnique({
            where: { id: batchId }
          });

          if (!currentBatch) {
            throw new Error(`Xato: Bazada tanlangan partiya topilmadi!`);
          }

          if (currentBatch.quantity < qtyToDecrease) {
            throw new Error(`Xato: ${currentProduct.name} ning tanlangan partiyasida yetarli qoldiq yo'q!`);
          }

          await tx.productBatch.update({
            where: { id: batchId },
            data: {
              quantity: { decrement: qtyToDecrease }
            }
          });
        }

        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { decrement: qtyToDecrease }
          }
        });
      }
    });

    res.json({
      success: true,
      message: "Tovarlar ombordan ayirildi"
    });
  } catch (error) {
    console.error("❌ QAYTIM XATOSI:", error);

    if (error.message?.startsWith('Xato:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: "Ombor yangilanmadi",
      details: error.message
    });
  }
};