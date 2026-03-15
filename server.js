import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { authenticateToken } from './middleware/auth.js';

import ordersRoutes from './routes/orders.routes.js';
import contractRoutes from './routes/contracts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import customersRoutes from './routes/customers.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import usersRoutes from './routes/users.routes.js';
import blacklistRoutes from './routes/blacklist.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';


import { getRegions } from './controllers/customers.controller.js';
import { createDirectorNotification } from './utils/notifications.js';
import { requirePermission } from './middleware/requirePermission.js';
import { PERMISSIONS } from './utils/permissions.js';
import cashboxesRoutes from './routes/cashboxes.routes.js';



dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("DIQQAT: JWT_SECRET .env faylida topilmadi!");
  process.exit(1);
}

app.use(cors({
  origin: [
    'https://iphone-house-frontend.vercel.app',
    'https://iphone-house.store',
    'https://www.iphone-house.store',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const normalizeProductName = (value) => {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

app.get('/', (req, res) => {
  res.send('Iphone House API is Running! 🚀');
});

/* =========================
   AUTH
========================= */

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Bunday foydalanuvchi topilmadi!"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Parol noto'g'ri!"
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        username: user.username,
        permissions: user.permissions || []
      }
    });
  } catch (error) {
    console.error("Login xatosi:", error);
    res.status(500).json({
      success: false,
      message: "Serverda xatolik yuz berdi"
    });
  }
});

/* =========================
   EXTERNAL ROUTES
========================= */

app.use('/api/orders', ordersRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/users', usersRoutes);
app.get('/api/regions', authenticateToken, getRegions);
app.use('/api/blacklist-requests', blacklistRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/cashboxes', cashboxesRoutes);


/* =========================
   SUPPLIERS
========================= */

app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: 'desc' }
    });

    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: "Xatolik" });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { customId, name, phone, address } = req.body;

    const newSupplier = await prisma.supplier.create({
      data: {
        customId,
        name,
        phone,
        address
      }
    });

    res.json(newSupplier);
  } catch (error) {
    console.error("Ta'minotchi qo'shishda xato:", error);
    res.status(500).json({ error: "Qo'shishda xatolik" });
  }
});

app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});


/* =========================
   CASH SALES
========================= */

app.get('/api/cash-sales', authenticateToken, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        user: true,
        items: true
      },
      orderBy: { id: 'desc' }
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: "Naqd savdolarni olishda xatolik" });
  }
});

app.post('/api/cash-sales', authenticateToken, async (req, res) => {
  try {
    const {
      isAnonymous,
      customerId,
      otherName,
      otherPhone,
      totalAmount,
      discount,
      finalAmount,
      note,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Savat bo'sh! Savdoga tovar kiritilmadi."
      });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          totalAmount: Number(totalAmount),
          discount: Number(discount || 0),
          finalAmount: Number(finalAmount || totalAmount),
          note: note || null,
          customerId: isAnonymous ? null : Number(customerId),
          userId: req.user.id,
          otherName: isAnonymous ? otherName : null,
          otherPhone: isAnonymous ? otherPhone : null,
          status: "JARAYONDA"
        }
      });

      for (const item of items) {
        const qty = Number(item.qty);
        const salePrice = Number(item.salePrice);

        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Xato: ${item.name} tovarining soni noto'g'ri kiritildi!`);
        }

        if (isNaN(salePrice) || salePrice < 0) {
          throw new Error(`Xato: ${item.name} tovarining narxi noto'g'ri!`);
        }

        const currentProd = await tx.product.findUnique({
          where: { id: item.id }
        });

        if (!currentProd) {
          throw new Error(`Xato: Bazada ID: ${item.id} bo'lgan tovar topilmadi!`);
        }

        if (currentProd.quantity < qty) {
          throw new Error(`Xato: ${item.name} tovaridan omborda yetarli qoldiq yo'q!`);
        }

        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.id,
            quantity: qty,
            price: salePrice
          }
        });
      }

      return newSale;
    });

    res.json({ success: true, sale });
  } catch (error) {
    console.error("Naqd savdo xatosi:", error);

    if (error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Naqd savdo saqlashda xatolik yuz berdi" });
  }
});

app.put('/api/cash-sales/:id', authenticateToken, async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const { totalAmount, discount, finalAmount, note, items } = req.body;

    const existingSale = await prisma.sale.findUnique({
      where: { id: saleId }
    });

    if (!existingSale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    if (existingSale.status === "TASDIQLANDI") {
      return res.status(400).json({
        error: "Tasdiqlangan savdoni tahrirlab bo'lmaydi!"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          totalAmount: Number(totalAmount),
          discount: Number(discount || 0),
          finalAmount: Number(finalAmount || totalAmount),
          note: note || null
        }
      });

      await tx.saleItem.deleteMany({
        where: { saleId }
      });

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId,
            productId: item.id,
            quantity: Number(item.qty),
            price: Number(item.salePrice)
          }
        });
      }
    });

    res.json({ success: true, message: "Savdo muvaffaqiyatli tahrirlandi" });
  } catch (error) {
    res.status(500).json({ error: "Tahrirlashda xatolik" });
  }
});

app.patch('/api/cash-sales/:id/approve', authenticateToken, async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    const { status } = req.body;

    const targetStatus = status ? status.toUpperCase() : "YAKUNLANGAN";

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    if (sale.status === "YAKUNLANGAN" || sale.status === "TASDIQLANDI") {
      return res.status(400).json({
        error: "Bu savdo allaqachon yakunlangan!"
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: targetStatus }
      });

      if (targetStatus === "YAKUNLANGAN") {
        for (const item of sale.items) {
          const currentProd = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (!currentProd || currentProd.quantity < item.quantity) {
            throw new Error(`Xato: Omborda tovar qoldig'i yetarli emas!`);
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { decrement: item.quantity }
            }
          });
        }

        const mainCashbox = await tx.cashbox.findFirst({
          orderBy: { id: 'asc' }
        });

        if (!mainCashbox) {
          throw new Error("Xato: Tizimda kassa topilmadi! Prisma Studio orqali bitta kassa yarating.");
        }

        await tx.cashbox.update({
          where: { id: mainCashbox.id },
          data: {
            balance: { increment: sale.finalAmount }
          }
        });

        await tx.transaction.create({
          data: {
            amount: sale.finalAmount,
            type: "INCOME",
            paymentMethod: "NAQD",
            reason: "Naqd Savdo",
            description: `Naqd savdo №${sale.id} bo'yicha to'lov`,
            referenceId: sale.id,
            cashboxId: mainCashbox.id,
            userId: req.user.id
          }
        });
      }
    });

    res.json({
      success: true,
      message: `Savdo ${targetStatus} holatiga o'tdi!`
    });
  } catch (error) {
    if (error.message && error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Tasdiqlashda xatolik yuz berdi" });
  }
});

app.delete('/api/cash-sales/:id', authenticateToken, async (req, res) => {
  try {
    const saleId = Number(req.params.id);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) {
      return res.status(404).json({ error: "Savdo topilmadi!" });
    }

    await prisma.$transaction(async (tx) => {
      if (sale.status === 'YAKUNLANGAN' || sale.status === 'TASDIQLANDI') {
        const transaction = await tx.transaction.findFirst({
          where: {
            referenceId: saleId,
            reason: "Naqd Savdo",
            type: "INCOME"
          }
        });

        if (transaction && transaction.cashboxId) {
          await tx.cashbox.update({
            where: { id: transaction.cashboxId },
            data: {
              balance: { decrement: transaction.amount }
            }
          });

          await tx.transaction.delete({
            where: { id: transaction.id }
          });
        }
      }

      if (sale.status === 'YAKUNLANGAN' || sale.status === 'TASDIQLANDI') {
        for (const item of sale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity }
            }
          });
        }
      }

      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.sale.delete({ where: { id: saleId } });
    });

    res.json({
      success: true,
      message: "Savdo bekor qilindi, tovarlar va pullar omborga/kassaga qaytarildi!"
    });
  } catch (error) {
    console.error("Delete Sale Error:", error);
    res.status(500).json({ error: "O'chirishda xatolik yuz berdi" });
  }
});

/* =========================
   CATEGORIES
========================= */

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'desc' }
    });

    res.json(categories);
  } catch (error) {
    console.error("Kategoriyalarni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi yuz berdi" });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "Kategoriya nomi kiritilmadi!" });
  }

  try {
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existingCategory) {
      return res.status(400).json({
        error: "Bu kategoriya bazada allaqachon mavjud!"
      });
    }

    const category = await prisma.category.create({
      data: { name: name.trim() }
    });

    res.json(category);
  } catch (error) {
    console.error("Kategoriya qo'shishda xatolik:", error);
    res.status(500).json({
      error: "Kategoriya qo'shishda server xatosi yuz berdi"
    });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    await prisma.category.delete({
      where: { id: categoryId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Kategoriyani o'chirishda xato:", error);
    res.status(400).json({
      error: "Bu kategoriyani o'chirib bo'lmaydi. Unga ulangan tovarlar mavjud!"
    });
  }
});

/* =========================
   PRODUCTS / SKLAD
========================= */

app.get('/api/products', authenticateToken, async (req, res) => {
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
});

app.post('/api/products', authenticateToken, async (req, res) => {
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
            initialQty: initialQty,
            quantity: initialQty,
            buyPrice: Number(buyPrice),
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
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
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
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});

app.patch('/api/products/batches/:id/archive', authenticateToken, async (req, res) => {
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
});

app.post('/api/products/increase-stock', authenticateToken, async (req, res) => {
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
            initialQty: addedQty,
            quantity: addedQty,
            buyPrice: price,
            salePrice,
            buyCurrency: currency
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

    if (error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Ombor yangilanmadi" });
  }
});

app.post('/api/products/decrease-stock', authenticateToken, async (req, res) => {
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

    if (error.message.startsWith("Xato:")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: "Ombor yangilanmadi",
      details: error.message
    });
  }
});

/* =========================
   INVENTORY
========================= */

app.post('/api/inventory/finish', authenticateToken, async (req, res) => {
  const { items, updateStock } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Sanoq ro'yxati bo'sh!" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const totalDiff = items.reduce((sum, item) => sum + item.diff, 0);

      const newAct = await tx.inventoryAct.create({
        data: {
          totalDiff,
          isStockUpdated: updateStock === true
        }
      });

      const updatedProductIds = new Set();

      for (const item of items) {
        await tx.inventoryItem.create({
          data: {
            inventoryActId: newAct.id,
            productId: item.id,
            systemQty: Number(item.systemQty),
            countedQty: Number(item.scannedQty),
            diff: Number(item.diff)
          }
        });

        if (updateStock === true) {
          if (item.batchId) {
            await tx.productBatch.update({
              where: { id: Number(item.batchId) },
              data: { quantity: Number(item.scannedQty) }
            });

            updatedProductIds.add(item.id);
          } else {
            await tx.product.update({
              where: { id: item.id },
              data: { quantity: Number(item.scannedQty) }
            });
          }
        }
      }

      if (updateStock === true) {
        for (const pId of updatedProductIds) {
          const aggregate = await tx.productBatch.aggregate({
            where: {
              productId: pId,
              isArchived: false
            },
            _sum: { quantity: true }
          });

          const totalQuantity = aggregate._sum.quantity || 0;

          await tx.product.update({
            where: { id: pId },
            data: { quantity: totalQuantity }
          });
        }
      }

      return newAct;
    });

    res.json({ success: true, actId: result.id });
  } catch (error) {
    console.error("Sanoq xatosi:", error);
    res.status(500).json({ error: "Sanoqni saqlashda xatolik bo'ldi" });
  }
});

app.get('/api/inventory/history', authenticateToken, async (req, res) => {
  try {
    const history = await prisma.inventoryAct.findMany({
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error("Tarixni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

/* =========================
   FIX OLD BATCHES
========================= */

app.get('/api/fix-old-batches', async (req, res) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { status: 'Tasdiqlandi' },
      include: { items: true }
    });

    let fixedCount = 0;

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const matchingBatches = await prisma.productBatch.findMany({
          where: {
            productId: item.productId,
            supplierName: null
          },
          orderBy: { id: 'asc' }
        });

        if (matchingBatches.length > 0) {
          await prisma.productBatch.update({
            where: { id: matchingBatches[0].id },
            data: {
              supplierName: invoice.supplierName,
              invoiceNumber: invoice.invoiceNumber
            }
          });

          fixedCount++;
        }
      }
    }

    res.json({
      success: true,
      message: `Qoyil! Jami ${fixedCount} ta eski partiyaga ta'minotchi nomi muvaffaqiyatli ulandi! 🎉`
    });
  } catch (error) {
    console.error("Davolashda xatolik:", error);
    res.status(500).json({ error: "Xatolik yuz berdi" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});