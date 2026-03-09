import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("DIQQAT: JWT_SECRET .env faylida topilmadi!");
    process.exit(1); // Xavfsizlik uchun serverni ishga tushirmasdan to'xtatadi
}

// Middleware
app.use(cors({
  origin: [ 'https://iphone-house-frontend.vercel.app',
            'https://iphone-house.store',
            'https://www.iphone-house.store'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Allow Backend to read JSON data

// ==========================================
// --- 1. XAVFSIZLIK: JWT MIDDLEWARE ---
// ==========================================
// Bu funksiya keyinchalik boshqa API'larni yopiq qilish uchun ishlatiladi
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" formatidan ajratib olamiz

    if (!token) return res.status(401).json({ error: "Token topilmadi! Tizimga kiring." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token yaroqsiz yoki muddati tugagan!" });
        req.user = user;
        next();
    });
};

// ==========================================
// --- 2. LOGIN API (HAQIQIY BAZA ORQALI) ---
// ==========================================
// DIQQAT: Login API da 'authenticateToken' bo'lmasligi SHART!
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Foydalanuvchini bazadan qidiramiz (Prismadagi User jadvalida username bo'yicha)
        let user = await prisma.user.findUnique({ 
            where: { username: username } 
        });

        // 2. MASTER DIREKTOR UCHUN AVTOMATIK YARATISH (Faqat birinchi kirishda ishlaydi)
        if (!user && username === 'director' && password === '777') {
            const hashedPassword = await bcrypt.hash('777', 10); // Parolni shifrlaymiz
            user = await prisma.user.create({
                data: {
                    fullName: 'Bosh Direktor',
                    username: 'director',
                    password: hashedPassword,
                    role: 'director'
                }
            });
        }

        // Agar foydalanuvchi umuman yo'q bo'lsa
        if (!user) {
            return res.status(401).json({ success: false, message: "Bunday foydalanuvchi topilmadi!" });
        }

        // 3. Parolni tekshirish (Kiritilgan parol bilan bazadagi shifrlangan parolni solishtiramiz)
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Parol noto'g'ri!" });
        }

        // 4. JWT Token yaratamiz (Pasport beramiz - u 24 soat ishlaydi)
        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 5. Javobni qaytaramiz
        res.json({
            success: true,
            token: token,
            user: { 
                id: user.id, 
                fullName: user.fullName, 
                role: user.role, 
                username: user.username 
            }
        });

    } catch (error) {
        console.error("Login xatosi:", error);
        res.status(500).json({ success: false, message: "Serverda xatolik yuz berdi" });
    }
});

// 1. Test Route
app.get('/', (req, res) => {
  res.send('Iphone House API is Running! 🚀');
});

// 2. Users Route
// ==========================================
// XODIMLAR (USERS) UCHUN API SO'ROVLARI
// ==========================================

// 1. Barcha xodimlarni ko'rish
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
        orderBy: { id: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Xodimlarni yuklashda xato yuz berdi" });
  }
});

// 2. Yangi xodim qo'shish
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { username, password, fullName, phone, role } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        return res.status(400).json({ message: "Bu login allaqachon band! Boshqa login o'ylab toping." });
    }

    // 🌟 PRO FIX: PAROLNI BAZAGA YUBORISHDAN OLDIN SHIFRLAYMIZ!
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { username, password: hashedPassword, fullName, phone, role } // <--- shifrlangan parol ketdi
    });
    
    res.json(newUser);
  } catch (error) {
    console.error("Xodim qo'shishda xato:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
});

// 3. Xodimni tahrirlash (Yangilash)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = Number(id);
    const tokenUserId = req.user.id;

    // 1. XAVFSIZLIK: Faqat direktor Yoki o'z profilini o'zgartirayotgan xodimga ruxsat
    if (req.user.role !== 'director' && tokenUserId !== targetUserId) {
        return res.status(403).json({ message: "Siz faqat o'zingizning profilingizni o'zgartira olasiz!" });
    }

    const { username, password, fullName, phone, role } = req.body;
    
    // 2. Eski ma'lumotlarni topib olamiz (xato chiqmasligi uchun)
    const existingUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existingUser) {
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    // 3. Yangilanadigan ma'lumotlarni yig'amiz
    const updateData = { 
        username: username || existingUser.username, 
        fullName: fullName || existingUser.fullName, 
        phone: phone || existingUser.phone, 
        // MUHIM: Rolni faqat direktor o'zgartira oladi, xodim o'ziga-o'zi direktorlikni bera olmaydi!
        role: req.user.role === 'director' ? (role || existingUser.role) : existingUser.role 
    };
    
    // 4. Agar parol kiritilgan bo'lsa, uni shifrlaymiz
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }

    // 5. Bazaga saqlash
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Xodimni yangilashda xato:", error);
    res.status(500).json({ message: "Yangilashda server xatosi yuz berdi" });
  }
});

// 4. Xodimni o'chirish
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "O'chirishda xato yuz berdi" });
  }
});

// ==========================================
// --- TA'MINOTCHILAR (SUPPLIERS) API ---
// ==========================================

// 1. Barchasini olish
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

// 2. Yangi ta'minotchi qo'shish
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

// 3. O'chirish
app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.supplier.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});

// --- MIJOZLAR (CUSTOMERS) ROUTES ---

// 1. Yangi mijoz qo'shish (TRANSACTION)
app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const data = req.body;

    const newCustomer = await prisma.$transaction(async (tx) => {
      // 1. Asosiy mijozni yaratish
      const customer = await tx.customer.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          gender: data.gender,
          dob: new Date(data.dob),
          pinfl: data.pinfl,
          note: data.note
        }
      });

      // 2. Pasport ma'lumotlari
      await tx.customerDocument.create({
        data: {
          customerId: customer.id,
          type: data.document.type,
          series: data.document.series,
          number: data.document.number,
          givenDate: new Date(data.document.givenDate),
          expiryDate: new Date(data.document.expiryDate),
          givenBy: data.document.givenBy
        }
      });

      // 3. Manzil
      await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          regionId: Number(data.address.regionId),
          districtId: Number(data.address.districtId),
          mfy: data.address.mfy, 
          street: data.address.street,
          landmark: data.address.landmark
        }
      });

      // 4. Telefon raqamlar
      if (data.phones && data.phones.length > 0) {
        await tx.customerPhone.createMany({
          data: data.phones.map(p => ({
            customerId: customer.id,
            name: p.name,
            phone: p.phone,
            isMain: p.isMain || false
          }))
        });
      }

      // 5. Ish joyi
      await tx.customerJob.create({
        data: {
          customerId: customer.id,
          type: data.job.type, 
          companyName: data.job.companyName || null,
          position: data.job.position || null,
          source: data.job.source
        }
      });

      return customer;
    });

    res.json({ success: true, customer: newCustomer });

  } catch (error) {
    console.error("Mijoz qo'shishda xatolik:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Bu JSHSHIR raqamli mijoz allaqachon mavjud!" });
    }
    res.status(500).json({ error: "Server xatosi" });
  }
});

// 2. Hududlarni olish
app.get('/api/regions', authenticateToken, async (req, res) => {
  try {
    const regions = await prisma.region.findMany({
      include: {
        districts: true 
      }
    });
    res.json(regions);
  } catch (error) {
    console.error("Hududlarni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// 3. Mijozlarni qidirish (Kengaytirilgan Filtr bilan)
app.get('/api/customers', authenticateToken, async (req, res) => {
  const { 
    search,         
    passportSeries, 
    passportNumber, 
    pinfl,          
    dob,            
    phone           
  } = req.query;
  
  const where = {};

  if (passportSeries) {
    where.document = { ...where.document, series: { contains: passportSeries, mode: 'insensitive' } };
  }
  if (passportNumber) {
    where.document = { ...where.document, number: { contains: passportNumber } };
  }
  if (pinfl) {
    where.pinfl = { contains: pinfl };
  }
  if (dob) {
    const startDate = new Date(dob);
    const endDate = new Date(dob);
    endDate.setDate(endDate.getDate() + 1); 
    
    where.dob = {
      gte: startDate,
      lt: endDate
    };
  }
  if (phone) {
    where.phones = {
      some: { phone: { contains: phone } }
    };
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { pinfl: { contains: search } },
      { phones: { some: { phone: { contains: search } } } }
    ];
  }

  try {
    const customers = await prisma.customer.findMany({
      where,
      include: {
        phones: true,
        document: true,
        job: true
      },
      orderBy: { id: 'desc' }
    });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Qidirishda xatolik" });
  }
});

// --- DASHBOARD STATS ROUTE ---
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // 1. Calculate Total Inventory Value (Ombor) - TO'G'RILANDI
    const products = await prisma.product.findMany();
    const inventoryValue = products.reduce((sum, item) => {
      // stockQuantity o'rniga quantity, sellPrice o'rniga buyPrice
      return sum + ((item.quantity || 0) * Number(item.buyPrice || 0));
    }, 0);

    // 2. Calculate Total Income (Kassa)
    const income = await prisma.transaction.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true }
    });

    // 3. Calculate Total Debt (Undiruv)
    const debt = await prisma.contract.aggregate({
      _sum: { debtAmount: true }
    });

    res.json({
      inventoryValue: inventoryValue || 0,
      totalIncome: income._sum.amount || 0,
      totalDebt: debt._sum.debtAmount || 0,
      productCount: products.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Stats error" });
  }
});

// --- CATEGORY ROUTES ---

// 1. Get all categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } } 
  });
  res.json(categories);
});

// 2. Add a new category (TO'G'RILANDI: authenticateToken qo'shildi)
app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const category = await prisma.category.create({
      data: { name }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Kategoriya qo'shishda xatolik" });
  }
});

// ==========================================
// --- TOVARLAR API (OMBOR) ---
// ==========================================

// --- BARCHA TOVARLARNI OLISH (Partiyalari bilan birga) ---
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

// --- 1. YANGI TOVAR QO'SHISH (1-Partiyasi bilan birga) ---
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { customId, name, category, buyPrice, salePrice, quantity, unit, buyCurrency, saleCurrency } = req.body;
    
    // --- VALIDATSIYA QISMI ---
    if (!name || !customId || !category) {
        return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmadi!" });
    }
    if (isNaN(Number(buyPrice)) || isNaN(Number(salePrice))) {
        return res.status(400).json({ error: "Narxlar faqat raqam bo'lishi shart!" });
    }
    
    const initialQty = Number(quantity) || 0;

    const product = await prisma.$transaction(async (tx) => {
        const newProd = await tx.product.create({
            data: {
                customId: Number(customId),
                name,
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
                    buyCurrency: buyCurrency
                }
            });
        }
        return newProd;
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Tovar qo'shishda xatolik yuz berdi" });
  }
});

// --- 2. TA'MINOTCHIDAN TOVAR QABUL QILISH (KIRIM) ---
app.post('/api/products/:id/receive', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.id);
    const { quantity, buyPrice, buyCurrency } = req.body;
    const addedQty = Number(quantity);

    if (addedQty <= 0) {
        return res.status(400).json({ error: "Kirim qilinayotgan tovar soni 0 dan katta bo'lishi kerak" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const newBatch = await tx.productBatch.create({
                data: {
                    productId: productId,
                    initialQty: addedQty,
                    quantity: addedQty,
                    buyPrice: Number(buyPrice),
                    buyCurrency: buyCurrency || 'USD'
                }
            });

            const updatedProduct = await tx.product.update({
                where: { id: productId },
                data: {
                    quantity: { increment: addedQty }, 
                    buyPrice: Number(buyPrice),        
                    buyCurrency: buyCurrency || 'USD'
                }
            });

            return updatedProduct;
        });

        res.json({ message: "Tovar muvaffaqiyatli kirim qilindi!", product: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Kirim qilishda server xatosi yuz berdi" });
    }
});

// 3. Tovarni o'chirish (DELETE)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});

// 4. Bitta mijozni ID orqali to'liq olish (TO'G'RILANDI: authenticateToken qo'shildi)
app.get('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      include: {
        document: true,
        address: true,
        phones: true,
        job: true
      }
    });

    if (!customer) {
      return res.status(404).json({ error: "Mijoz topilmadi" });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// 5. Mijoz ma'lumotlarini yangilash (PUT)
app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const customerId = Number(id);

  try {
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          gender: data.gender,
          dob: new Date(data.dob),
          pinfl: data.pinfl,
          note: data.note
        }
      });

      await tx.customerDocument.delete({ where: { customerId } });
      await tx.customerDocument.create({
        data: {
          customerId,
          type: data.document.type,
          series: data.document.series,
          number: data.document.number,
          givenDate: new Date(data.document.givenDate),
          expiryDate: new Date(data.document.expiryDate),
          givenBy: data.document.givenBy
        }
      });

      await tx.customerAddress.delete({ where: { customerId } });
      await tx.customerAddress.create({
        data: {
          customerId,
          regionId: Number(data.address.regionId),
          districtId: Number(data.address.districtId),
          mfy: data.address.mfy,
          street: data.address.street,
          landmark: data.address.landmark
        }
      });

      await tx.customerPhone.deleteMany({ where: { customerId } });
      if (data.phones && data.phones.length > 0) {
        await tx.customerPhone.createMany({
          data: data.phones.map(p => ({
            customerId,
            name: p.name,
            phone: p.phone,
            isMain: p.isMain || false
          }))
        });
      }

      await tx.customerJob.delete({ where: { customerId } });
      await tx.customerJob.create({
        data: {
          customerId,
          type: data.job.type,
          companyName: data.job.companyName || null,
          position: data.job.position || null,
          source: data.job.source
        }
      });

      return { success: true, id: customerId };
    });

    res.json(updatedCustomer);

  } catch (error) {
    console.error("Yangilashda xatolik:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Bu JSHSHIR raqam boshqa mijozga tegishli!" });
    }
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ==========================================
// --- OMBORGA KIRIM (YANGI PARTIYA YARATISH) ---
// ==========================================
app.post('/api/products/increase-stock', authenticateToken, async (req, res) => {
  const items = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        
        const addedQty = Number(item.quantity || item.count || item.inputQty);
        const productId = Number(item.id);

        const currentProduct = await tx.product.findUnique({
            where: { id: productId }
        });

        if (!currentProduct) {
            throw new Error(`Bazada ID: ${productId} bo'lgan tovar topilmadi`);
        }

        const price = Number(item.buyPrice || item.price || item.inputPrice || currentProduct.buyPrice);
        const salePrice = Number(item.salePrice || item.inputSalePrice || currentProduct.salePrice);
        const currency = item.buyCurrency || item.currency || item.inputCurrency || currentProduct.buyCurrency || 'UZS';

        await tx.productBatch.create({
          data: {
            productId: productId,
            initialQty: addedQty,
            quantity: addedQty, 
            buyPrice: price,
            salePrice: salePrice,  
            buyCurrency: currency
          }
        });

        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { increment: addedQty },
            buyPrice: price,
            salePrice: salePrice,  
            buyCurrency: currency
          }
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ OMBOR KIRIM XATOSI:", error);
    res.status(500).json({ error: "Ombor yangilanmadi" });
  }
});

// --- PARTIYANI ARXIVLASH (YASHIRISH) ---
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

// --- TOVAR QOLDIG'INI KAMAYTIRISH API'si (Sizning mantiqingiz bo'yicha) ---
app.post('/api/products/decrease-stock', authenticateToken, async (req, res) => {
    const items = req.body;

    try {
        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const qtyToDecrease = Number(item.inputQty);
                const productId = Number(item.id);

                await tx.product.update({
                    where: { id: productId },
                    data: {
                        quantity: { decrement: qtyToDecrease }
                    }
                });

                if (item.batchId && !String(item.batchId).startsWith('old-')) {
                    await tx.productBatch.update({
                        where: { id: Number(item.batchId) },
                        data: {
                            quantity: { decrement: qtyToDecrease }
                        }
                    });
                }
            }
        });

        res.json({ success: true, message: "Tovarlar ombordan ayirildi" });
    } catch (error) {
        console.error("❌ QAYTIM XATOSI:", error);
        res.status(500).json({ error: "Ombor yangilanmadi", details: error.message });
    }
});

// ==========================================
// --- SANOQNI YAKUNLASH (INVENTORY FINISH) ---
// ==========================================
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
          totalDiff: totalDiff,
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

// ==========================================
// --- SANOQ TARIXI (GET) ---
// ==========================================
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

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});





