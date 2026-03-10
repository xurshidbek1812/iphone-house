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

const normalizeProductName = (value) => {
    if (!value) return "";
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

// ==========================================
// --- 2. LOGIN API (HAQIQIY BAZA ORQALI) ---
// ==========================================
// DIQQAT: Login API da 'authenticateToken' bo'lmasligi SHART!
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Foydalanuvchini bazadan qidiramiz
        const user = await prisma.user.findUnique({ 
            where: { username: username } 
        });

        // Agar foydalanuvchi umuman yo'q bo'lsa
        if (!user) {
            return res.status(401).json({ success: false, message: "Bunday foydalanuvchi topilmadi!" });
        }

        // 2. Parolni tekshirish
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Parol noto'g'ri!" });
        }

        // 3. JWT Token yaratamiz (24 soatlik muddat bilan)
        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 4. Muvaffaqiyatli javobni qaytaramiz
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

// 1. Barcha xodimlarni ko'rish (FAQAT DIREKTOR UCHUN)
app.get('/api/users', authenticateToken, async (req, res) => {
  // 🚨 HIMOYA: Faqat direktor barcha xodimlar ro'yxatini ko'ra oladi!
  if (req.user.role !== 'director') {
      return res.status(403).json({ message: "Sizda xodimlar ro'yxatini ko'rish huquqi yo'q!" });
  }

  try {
    const users = await prisma.user.findMany({ 
        orderBy: { id: 'desc' },
        select: { id: true, username: true, fullName: true, role: true, phone: true } 
    });
    res.json(users);
  } catch (error) { 
      res.status(500).json({ message: "Xodimlarni yuklashda xato" }); 
  }
});

// --- O'Z PROFILINI OLISH UCHUN ---
app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, username: true, fullName: true, role: true, phone: true }
        });
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: "Xato" });
    }
});

// 2. Yangi xodim qo'shish (FAQAT DIREKTOR UCHUN + PAROL YASHIRILDI)
app.post('/api/users', authenticateToken, async (req, res) => {
  // HIMOYA: Faqat direktor yangi odam qo'sha oladi
  if (req.user.role !== 'director') return res.status(403).json({ message: "Sizda yangi xodim qo'shish huquqi yo'q!" });

  try {
    const { username, password, fullName, phone, role } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return res.status(400).json({ message: "Bu login allaqachon band! Boshqa login o'ylab toping." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { username, password: hashedPassword, fullName, phone, role },
      // HIMOYA: Javobda parolni yashiramiz!
      select: { id: true, username: true, fullName: true, role: true, phone: true }
    });
    
    res.json(newUser);
  } catch (error) {
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
});

// 3. Xodimni tahrirlash (LOGIN BANDLIGI + JORIY PAROLNI TEKSHIRISH + PAROL YASHIRILDI)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const tokenUserId = req.user.id;

    if (req.user.role !== 'director' && tokenUserId !== targetUserId) {
        return res.status(403).json({ message: "Siz faqat o'zingizning profilingizni o'zgartira olasiz!" });
    }

    const { username, password, currentPassword, fullName, phone, role } = req.body;
    
    // HIMOYA: Agar usernameni o'zgartirayotgan bo'lsa, boshqasida yo'qligini tekshiramiz
    if (username) {
        const usernameTaken = await prisma.user.findFirst({ where: { username: username, NOT: { id: targetUserId } } });
        if (usernameTaken) return res.status(400).json({ message: "Bu login boshqa xodim tomonidan band qilingan!" });
    }

    const existingUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existingUser) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

    const updateData = { 
        username: username || existingUser.username, 
        fullName: fullName || existingUser.fullName, 
        phone: phone || existingUser.phone, 
        role: req.user.role === 'director' ? (role || existingUser.role) : existingUser.role 
    };
    
    // HIMOYA: Parolni o'zgartirish logikasi
    if (password) {
        // Agar xodim (yoki direktor) O'ZINING parolini o'zgartirayotgan bo'lsa:
        if (tokenUserId === targetUserId) {
            if (!currentPassword) {
                return res.status(400).json({ message: "Parolni o'zgartirish uchun joriy (eski) parolni kiritishingiz shart!" });
            }
            const isMatch = await bcrypt.compare(currentPassword, existingUser.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Joriy parol noto'g'ri kiritildi!" });
            }
        }
        // Agar tekshiruvlardan o'tsa yoki Direktor boshqa odamning parolini tiklayotgan bo'lsa:
        updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: { id: true, username: true, fullName: true, role: true, phone: true } // PAROL YASHIRILDI
    });
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Yangilashda server xatosi yuz berdi" });
  }
});

// 4. Xodimni o'chirish
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    // 1-HIMOYA: Faqat direktor o'chira oladi
    if (req.user.role !== 'director') {
        return res.status(403).json({ message: "Sizda xodimlarni o'chirish huquqi yo'q!" });
    }

    const targetUserId = Number(req.params.id);

    // 2-HIMOYA: Direktor o'zini o'zi o'chirib yubormasligi kerak!
    if (req.user.id === targetUserId) {
        return res.status(400).json({ message: "Xatolik: Siz o'z hisobingizni o'chira olmaysiz!" });
    }
    
    try { 
        await prisma.user.delete({ where: { id: targetUserId } }); 
        res.json({ success: true }); 
    } catch (error) { 
        console.error("Xodimni o'chirishda xato:", error);
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


// 6. Mijozni butunlay o'chirish (DELETE)
app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  const customerId = Number(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Mijozga tegishli barcha yordamchi ma'lumotlarni o'chiramiz (Tozalash)
      await tx.customerDocument.deleteMany({ where: { customerId } });
      await tx.customerAddress.deleteMany({ where: { customerId } });
      await tx.customerPhone.deleteMany({ where: { customerId } });
      await tx.customerJob.deleteMany({ where: { customerId } });

      // 2. Va nihoyat asosiy mijoz profilini o'chiramiz
      await tx.customer.delete({ where: { id: customerId } });
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Mijozni o'chirishda xatolik:", error);
    // Himoya: Agar bu mijozga ulangan sotuv (Sale) yoki shartnoma (Contract) bo'lsa
    if (error.code === 'P2003') {
      return res.status(400).json({ error: "Bu mijozni o'chirib bo'lmaydi! Uning nomida savdo yoki shartnomalar mavjud." });
    }
    res.status(500).json({ error: "O'chirishda xatolik yuz berdi" });
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

// ==========================================
// --- QORA RO'YXAT (BLACKLIST) API ---
// ==========================================

// 1. Qora ro'yxat buyurtmalarini olish
app.get('/api/blacklist-requests', authenticateToken, async (req, res) => {
    try {
        const requests = await prisma.blacklistRequest.findMany({
            include: { customer: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: "Buyurtmalarni yuklashda xato" });
    }
});

// 2. Yangi buyurtma yaratish
app.post('/api/blacklist-requests', authenticateToken, async (req, res) => {
    try {
        const { customerId, type, reason, requesterName } = req.body;
        const newReq = await prisma.blacklistRequest.create({
            data: { customerId: Number(customerId), type, reason, requesterName }
        });
        res.json(newReq);
    } catch (error) {
        res.status(500).json({ error: "Yaratishda xato" });
    }
});

// 5. Qora ro'yxat buyurtmasi sababini tahrirlash (PUT)
app.put('/api/blacklist-requests/:id', authenticateToken, async (req, res) => {
    try {
        const { reason } = req.body;
        await prisma.blacklistRequest.update({
            where: { id: Number(req.params.id) },
            data: { reason: reason }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Tahrirlashda xatolik yuz berdi" });
    }
});

// 3. Statusni o'zgartirish va Tasdiqlash (Eng asosiy logika)
app.patch('/api/blacklist-requests/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status, approverName } = req.body;
        const reqId = Number(req.params.id);

        const request = await prisma.blacklistRequest.findUnique({ where: { id: reqId } });
        if (!request) return res.status(404).json({ error: "Topilmadi" });

        // 1. Statusni o'zgartiramiz
        await prisma.blacklistRequest.update({
            where: { id: reqId },
            data: { status, approverName: approverName || null }
        });

        // 2. Agar "Tasdiqlandi" bo'lsa, Mijozning (Customer) statusini ham o'zgartiramiz!
        if (status === 'Tasdiqlandi') {
            await prisma.customer.update({
                where: { id: request.customerId },
                data: { isBlacklisted: request.type === 'ADD' ? true : false } // ADD bo'lsa qora ro'yxatga kiradi, REMOVE bo'lsa chiqadi
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Xatolik yuz berdi" });
    }
});

// 4. Buyurtmani o'chirish (Faqat "Jarayonda" bo'lsa)
app.delete('/api/blacklist-requests/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.blacklistRequest.delete({ where: { id: Number(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "O'chirishda xatolik" });
    }
});

// ==========================================
// --- DASHBOARD API (YANGILANGAN) ---
// ==========================================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // 1. Calculate Total Inventory Value (Ombor)
    const products = await prisma.product.findMany();
    const inventoryValue = products.reduce((sum, item) => {
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

    const stats = {
      inventoryValue: inventoryValue || 0,
      totalIncome: income._sum.amount || 0,
      totalDebt: debt._sum.debtAmount || 0,
      productCount: products.length
    };

    // 4. HAQIQIY BILDIRISHNOMALAR (So'nggi savdolar / harakatlar)
    const recentSales = await prisma.sale.findMany({
        take: 10,
        orderBy: { id: 'desc' },
        include: { user: true, customer: true }
    });

    const notifications = recentSales.map(sale => ({
        id: sale.id,
        type: 'Naqd Savdo',
        supplier: sale.customer ? `${sale.customer.lastName} ${sale.customer.firstName}` : (sale.otherName || 'Anonim mijoz'),
        sender: sale.user?.fullName || 'Xodim',
        totalSum: sale.totalAmount,
        date: sale.date.toLocaleString('uz-UZ'),
        status: 'Yuborildi',
        isRead: false
    }));

    // Ham statlarni, ham xabarlarni bitta json qilib jo'natamiz
    res.json({ stats, notifications });
  } catch (error) {
    console.error("Dashboard xatosi:", error);
    res.status(500).json({ error: "Stats error" });
  }
});
// ==========================================
// --- FAKTURALAR (INVOICES) API ---
// ==========================================

// 1. Barcha fakturalarni olish (Hammaga ko'rinadi)
app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fakturalarni olishda xatolik" });
  }
});

// 2. Yangi faktura yaratish
app.post('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const { date, supplier, invoiceNumber, exchangeRate, totalSum, status, userName, items } = req.body;
    
    const newInvoice = await prisma.supplierInvoice.create({
      data: {
        date: new Date(date),
        supplierName: supplier,
        invoiceNumber: invoiceNumber,
        exchangeRate: Number(exchangeRate),
        totalSum: Number(totalSum),
        status: status || 'Jarayonda',
        userName: userName,
        items: {
          create: items.map(item => ({
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
    console.error(error);
    res.status(500).json({ error: "Faktura saqlashda xatolik" });
  }
});

// 3. Fakturani tahrirlash (Edit)
app.put('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const { date, supplier, invoiceNumber, exchangeRate, totalSum, status, items } = req.body;
    const invoiceId = Number(req.params.id);

    await prisma.$transaction(async (tx) => {
      // 1. Asosiy fakturani yangilash
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          date: new Date(date),
          supplierName: supplier,
          invoiceNumber: invoiceNumber,
          exchangeRate: Number(exchangeRate),
          totalSum: Number(totalSum),
          status: status
        }
      });

      // 2. Ichidagi eski tovarlarni o'chirib, yangilarini yozish (Eng xavfsiz usul)
      await tx.supplierInvoiceItem.deleteMany({ where: { supplierInvoiceId: invoiceId } });
      
      await tx.supplierInvoiceItem.createMany({
        data: items.map(item => ({
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
    console.error(error);
    res.status(500).json({ error: "Tahrirlashda xatolik yuz berdi" });
  }
});

// 4. Faktura holatini o'zgartirish (Masalan: Jarayonda -> Tasdiqlandi)
app.patch('/api/invoices/:id/status', authenticateToken, async (req, res) => {
    try {
        await prisma.supplierInvoice.update({
            where: { id: Number(req.params.id) },
            data: { status: req.body.status }
        });
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: "Holatni o'zgartirishda xatolik" });
    }
});

// 5. Fakturani butunlay o'chirish
app.delete('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.supplierInvoice.delete({ where: { id: Number(req.params.id) }});
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
});

// ==========================================
// --- SHARTNOMALAR (CONTRACTS) API ---
// ==========================================

// 1. Barcha shartnomalarni olish (Ro'yxat uchun)
app.get('/api/contracts', authenticateToken, async (req, res) => {
    try {
        const contracts = await prisma.contract.findMany({
            include: { 
                customer: {
                    include: { phones: true } // Mijozning telefon raqamlarini ham olamiz
                }, 
                user: true,
                items: {
                    include: { product: true } // Shartnoma ichidagi tovarlar va ularning nomlari
                },
                payments: true // Shu paytgacha qilingan barcha to'lovlar
            },
            orderBy: { id: 'desc' }
        });
        res.json(contracts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Shartnomalarni olishda xatolik" });
    }
});

// 2. Yangi shartnoma yaratish (Sotuv)
app.post('/api/contracts', authenticateToken, async (req, res) => {
    try {
        const { customerId, staffId, durationMonths, totalAmount, prepayment, debtAmount, items } = req.body;
        
        // 1-HIMOYA: items ro'yxat ekanligini va bo'sh emasligini tekshiramiz
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Shartnomaga tovarlar kiritilmadi!" });
        }

        const contract = await prisma.$transaction(async (tx) => {
            // 1. Shartnoma yaratamiz
            const newContract = await tx.contract.create({
                data: {
                    contractNumber: `SH-${Date.now().toString().slice(-6)}`,
                    customerId: Number(customerId),
                    userId: Number(staffId),
                    totalAmount: Number(totalAmount),
                    paidAmount: Number(prepayment),
                    debtAmount: Number(debtAmount),
                    durationMonths: Number(durationMonths),
                    status: "ACTIVE"
                }
            });

            // 2. Ichidagi tovarlarni yozamiz va OMBORDAN AYIRAMIZ
            for (const item of items) {
                // 🚨 2-HIMOYA: Soni 0 dan katta va aniq raqam ekanligini tekshiramiz
                const qty = Number(item.qty);
                if (isNaN(qty) || qty <= 0) {
                    throw new Error(`Xato: ${item.name} tovarining soni noto'g'ri kiritildi (0 dan katta bo'lishi shart)!`);
                }

                // 3-HIMOYA: Narxlar to'g'ri ekanligini tekshiramiz
                const salePrice = Number(item.salePrice);
                if (isNaN(salePrice) || salePrice < 0) {
                    throw new Error(`Xato: ${item.name} tovarining narxi noto'g'ri!`);
                }

                // 4-HIMOYA: Tovar qoldig'ini tekshiramiz
                const currentProd = await tx.product.findUnique({ where: { id: item.id } });
                if (!currentProd) {
                    throw new Error(`Xato: Bazada ID: ${item.id} bo'lgan tovar topilmadi!`);
                }

                if (currentProd.quantity < qty) {
                    throw new Error(`Xato: ${item.name} tovaridan omborda yetarli qoldiq yo'q!`);
                }

                await tx.contractItem.create({ 
                    data: {
                        contractId: newContract.id,
                        productId: item.id,
                        quantity: qty,
                        price: salePrice
                    }
                });

                // Ombordan minus qilish
                await tx.product.update({
                    where: { id: item.id },
                    data: { quantity: { decrement: qty } }
                });
            }

            // 3. Agar oldindan to'lov (Prepayment) bo'lsa, uni Kassaga (Transaction) yozamiz
            if (Number(prepayment) > 0) {
                await tx.payment.create({
                    data: {
                        contractId: newContract.id,
                        amount: Number(prepayment),
                        type: "CASH"
                    }
                });
                
                await tx.transaction.create({
                    data: {
                        amount: Number(prepayment),
                        type: "INCOME",
                        category: "Shartnoma to'lovi",
                        description: `Shartnoma ${newContract.contractNumber} bo'yicha boshlang'ich to'lov`,
                        userId: req.user.id
                    }
                });
            }

            return newContract;
        });

        res.json({ success: true, contract });
    } catch (error) {
        console.error("Shartnoma xatosi:", error);
        
        // 5-HIMOYA: Agar xato o'zimiz yozgan "Xato:" so'zi bilan boshlansa, uni mijozga ko'rsatamiz
        if (error.message.startsWith("Xato:")) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Shartnoma yaratishda xatolik yuz berdi" });
    }
});

// ==========================================
// --- NAQD SAVDO (CASH SALES) API ---
// ==========================================

app.get('/api/cash-sales', authenticateToken, async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            include: { customer: true, user: true, items: true },
            orderBy: { id: 'desc' }
        });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: "Naqd savdolarni olishda xatolik" });
    }
});

// 2. Yangi naqd savdo yaratish (FAQAT SAQLASH - JARAYONDA)
app.post('/api/cash-sales', authenticateToken, async (req, res) => {
    try {
        // 🚨 QO'SHIMCHA PARAMETRLAR: discount va note qabul qilinadi
        const { isAnonymous, customerId, otherName, otherPhone, totalAmount, discount, finalAmount, note, items } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Savat bo'sh! Savdoga tovar kiritilmadi." });
        }

        const sale = await prisma.$transaction(async (tx) => {
            const newSale = await tx.sale.create({
                data: {
                    totalAmount: Number(totalAmount),
                    discount: Number(discount || 0),           // 🚨 BAZAGA YOZILADI
                    finalAmount: Number(finalAmount || totalAmount), // 🚨 BAZAGA YOZILADI
                    note: note || null,                        // 🚨 BAZAGA YOZILADI
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
                
                if (isNaN(qty) || qty <= 0) throw new Error(`Xato: ${item.name} tovarining soni noto'g'ri kiritildi!`);
                if (isNaN(salePrice) || salePrice < 0) throw new Error(`Xato: ${item.name} tovarining narxi noto'g'ri!`);

                const currentProd = await tx.product.findUnique({ where: { id: item.id } });
                if (!currentProd) throw new Error(`Xato: Bazada ID: ${item.id} bo'lgan tovar topilmadi!`);
                if (currentProd.quantity < qty) throw new Error(`Xato: ${item.name} tovaridan omborda yetarli qoldiq yo'q!`);

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
        if (error.message.startsWith("Xato:")) return res.status(400).json({ error: error.message });
        res.status(500).json({ error: "Naqd savdo saqlashda xatolik yuz berdi" });
    }
});

// 3. Savdoni tahrirlash (Agar hali tasdiqlanmagan bo'lsa)
app.put('/api/cash-sales/:id', authenticateToken, async (req, res) => {
    try {
        const saleId = Number(req.params.id);
        const { totalAmount, discount, finalAmount, note, items } = req.body;
        
        const existingSale = await prisma.sale.findUnique({ where: { id: saleId } });
        if (!existingSale) return res.status(404).json({ error: "Savdo topilmadi!" });
        if (existingSale.status === "TASDIQLANDI") return res.status(400).json({ error: "Tasdiqlangan savdoni tahrirlab bo'lmaydi!" });

        await prisma.$transaction(async (tx) => {
            // Asosiy ma'lumotlarni yangilash (Chegirma va izohni ham)
            await tx.sale.update({
                where: { id: saleId },
                data: {
                    totalAmount: Number(totalAmount),
                    discount: Number(discount || 0),
                    finalAmount: Number(finalAmount || totalAmount),
                    note: note || null
                }
            });

            // Eski tovarlarni o'chirib, yangilarini yozamiz
            await tx.saleItem.deleteMany({ where: { saleId } });

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

// 3. Savdoni Tasdiqlash (PUL TUSHADI VA TOVAR OMBORDAN KETADI)
app.patch('/api/cash-sales/:id/approve', authenticateToken, async (req, res) => {
    try {
        const saleId = Number(req.params.id);
        
        const sale = await prisma.sale.findUnique({ 
            where: { id: saleId },
            include: { items: true }
        });

        if (!sale) return res.status(404).json({ error: "Savdo topilmadi!" });
        if (sale.status === "TASDIQLANDI") return res.status(400).json({ error: "Bu savdo allaqachon tasdiqlangan!" });

        await prisma.$transaction(async (tx) => {
            await tx.sale.update({
                where: { id: saleId },
                data: { status: "TASDIQLANDI" }
            });

            for (const item of sale.items) {
                const currentProd = await tx.product.findUnique({ where: { id: item.productId } });
                if (!currentProd || currentProd.quantity < item.quantity) {
                    throw new Error(`Xato: Omborda tovar qoldig'i yetarli emas!`);
                }
                
                await tx.product.update({
                    where: { id: item.productId },
                    data: { quantity: { decrement: item.quantity } }
                });
            }

            // 🚨 DIQQAT: Kassaga "totalAmount" emas, "finalAmount" (Chegirmadan keyingi sof summa) tushadi!
            await tx.transaction.create({
                data: {
                    amount: sale.finalAmount, 
                    type: "INCOME",
                    category: "Naqd Savdo",
                    description: `Naqd savdo №${sale.id} bo'yicha to'lov`,
                    userId: req.user.id
                }
            });
        });

        res.json({ success: true, message: "Savdo tasdiqlandi, tovarlar ombordan yechildi va kassaga pul tushdi!" });
    } catch (error) {
        if (error.message.startsWith("Xato:")) return res.status(400).json({ error: error.message });
        res.status(500).json({ error: "Tasdiqlashda xatolik yuz berdi" });
    }
});

// 4. Savdoni O'chirish (Agar Jarayonda bo'lsa)
app.delete('/api/cash-sales/:id', authenticateToken, async (req, res) => {
    try {
        const saleId = Number(req.params.id);
        const sale = await prisma.sale.findUnique({ where: { id: saleId } });
        
        if (!sale) return res.status(404).json({ error: "Savdo topilmadi!" });
        if (sale.status === "TASDIQLANDI") return res.status(400).json({ error: "Tasdiqlangan savdoni o'chirib bo'lmaydi!" });

        await prisma.saleItem.deleteMany({ where: { saleId } });
        await prisma.sale.delete({ where: { id: saleId } });

        res.json({ success: true, message: "Savdo o'chirildi" });
    } catch (error) {
        res.status(500).json({ error: "O'chirishda xatolik yuz berdi" });
    }
});

// --- CATEGORY ROUTES ---

// 1. Get all categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
        orderBy: { id: 'desc' } // Eng oxirgi qo'shilganlar birinchi chiqadi
    });
    res.json(categories);
  } catch (error) {
    console.error("Kategoriyalarni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi yuz berdi" });
  }
});

// 2. Add a new category (MUKAMMAL VA HIMOYALANGAN HOLAT)
app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name } = req.body;

  // 1-HIMOYA: Bo'sh nom yuborilishini to'xtatish
  if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Kategoriya nomi kiritilmadi!" });
  }

  try {
    // 2-HIMOYA: Bunday nomli kategoriya bazada bor-yo'qligini tekshirish
    // mode: 'insensitive' degani "Telefon" bilan "telefon" ni bir xil deb tushunadi
    const existingCategory = await prisma.category.findFirst({
        where: {
            name: {
                equals: name.trim(),
                mode: 'insensitive' 
            }
        }
    });

    if (existingCategory) {
        return res.status(400).json({ error: "Bu kategoriya bazada allaqachon mavjud!" });
    }

    // 3. Hamma tekshiruvdan o'tsa, keyin saqlaymiz
    const category = await prisma.category.create({
      data: { name: name.trim() }
    });
    
    res.json(category);
  } catch (error) {
    console.error("Kategoriya qo'shishda xatolik:", error);
    res.status(500).json({ error: "Kategoriya qo'shishda server xatosi yuz berdi" });
  }
});

// 3. Kategoriyani o'chirish (DELETE)
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    await prisma.category.delete({
      where: { id: categoryId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Kategoriyani o'chirishda xato:", error);
    // Agar bu kategoriyaga ulangan tovarlar bo'lsa, xato beradi (himoya)
    res.status(400).json({ error: "Bu kategoriyani o'chirib bo'lmaydi. Unga ulangan tovarlar mavjud!" });
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

// --- 1. YANGI TOVAR QO'SHISH (POST) ---
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { customId, name, category, buyPrice, salePrice, quantity, unit, buyCurrency, saleCurrency } = req.body;
    
    if (!name || !customId || !category) {
        return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmadi!" });
    }
    if (isNaN(Number(buyPrice)) || isNaN(Number(salePrice))) {
        return res.status(400).json({ error: "Narxlar faqat raqam bo'lishi shart!" });
    }

    // 🚨 1-QADAM: Nomni normalizatsiya qilamiz (bo'shliqlarni tozalaymiz)
    const normalizedName = normalizeProductName(name);
    const initialQty = Number(quantity) || 0;

    const product = await prisma.$transaction(async (tx) => {
        const newProd = await tx.product.create({
            data: {
                customId: Number(customId),
                name: name.trim(), 
                normalizedName: normalizedName, // 🚨 BAZAGA SAQLASH
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
    console.error("Tovar qo'shish xatosi:", error);
    // 🚨 2-QADAM: PRISMA UNIQUE XATOSI (P2002) NI USHLASH
    if (error.code === 'P2002') {
        return res.status(400).json({ error: "Bu nomdagi tovar bazada allaqachon mavjud!" });
    }
    res.status(500).json({ error: "Tovar qo'shishda xatolik yuz berdi" });
  }
});

// --- TOVARNI TAHRIRLASH (PUT) ---
app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const { name, category, unit, buyPrice, salePrice } = req.body;
        
        if (!name) return res.status(400).json({ error: "Tovar nomi bo'sh bo'lishi mumkin emas!" });

        // Nomi normalizatsiya qilinadi
        const normalizedName = normalizeProductName(name);
        
        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
                name: name.trim(),
                normalizedName: normalizedName, // 🚨 TAHRIRLASHDAGI HIMOYA
                category: category,
                unit: unit,
                buyPrice: Number(buyPrice),
                salePrice: Number(salePrice)
            }
        });
        
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        console.error("Tovarni tahrirlashda xatolik:", error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Siz o'zgartirgan nomni boshqa tovar band qilgan!" });
        }
        res.status(500).json({ error: "Tovarni tahrirlashda xatolik yuz berdi" });
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

  // 1-HIMOYA: items ro'yxat ekanligini va bo'sh emasligini tekshiramiz
  if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Qo'shish uchun tovarlar ro'yxati kiritilmadi!" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        
        const addedQty = Number(item.quantity || item.count || item.inputQty);
        const productId = Number(item.id);

        // 2-HIMOYA: Soni 0 dan katta va aniq raqam ekanligini tekshiramiz
        if (isNaN(addedQty) || addedQty <= 0) {
            throw new Error(`Xato: Tovar soni noto'g'ri kiritildi (0 dan katta bo'lishi shart)!`);
        }

        const currentProduct = await tx.product.findUnique({
            where: { id: productId }
        });

        if (!currentProduct) {
            throw new Error(`Xato: Bazada ID: ${productId} bo'lgan tovar topilmadi!`);
        }

        const price = Number(item.buyPrice || item.price || item.inputPrice || currentProduct.buyPrice);
        const salePrice = Number(item.salePrice || item.inputSalePrice || currentProduct.salePrice);
        
        // 3-HIMOYA: Narxlar aniq raqam ekanligini va manfiy emasligini tekshiramiz
        if (isNaN(price) || price < 0 || isNaN(salePrice) || salePrice < 0) {
            throw new Error(`Xato: ${currentProduct.name} tovarining narxlari noto'g'ri kiritildi!`);
        }

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
    
    // Agar xato o'zimiz yozgan "Xato:" so'zi bilan boshlansa, uni frontendga aniq qilib yuboramiz
    if (error.message.startsWith("Xato:")) {
        return res.status(400).json({ error: error.message });
    }

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

    // 1-HIMOYA: items ro'yxat ekanligini va bo'sh emasligini tekshiramiz
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Kamaytirish uchun tovarlar ro'yxati kiritilmadi!" });
    }

    try {
        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const qtyToDecrease = Number(item.inputQty);
                const productId = Number(item.id);

                // 2-HIMOYA: Soni 0 dan katta va aniq raqam ekanligini tekshiramiz
                if (isNaN(qtyToDecrease) || qtyToDecrease <= 0) {
                    throw new Error(`Xato: Tovar soni noto'g'ri kiritildi (0 dan katta bo'lishi shart)!`);
                }

                // 3-HIMOYA: Tovar bazada borligi va umumiy qoldiq yetarliligini tekshirish
                const currentProduct = await tx.product.findUnique({
                    where: { id: productId }
                });

                if (!currentProduct) {
                    throw new Error(`Xato: Bazada ID: ${productId} bo'lgan tovar topilmadi!`);
                }

                if (currentProduct.quantity < qtyToDecrease) {
                    throw new Error(`Xato: ${currentProduct.name} tovaridan omborda yetarli qoldiq yo'q!`);
                }

                // 4-HIMOYA: Agar partiyadan (batch) ayirilayotgan bo'lsa, partiya qoldig'ini ham tekshirish
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

                    // Partiyadan ayirish
                    await tx.productBatch.update({
                        where: { id: batchId },
                        data: {
                            quantity: { decrement: qtyToDecrease }
                        }
                    });
                }

                // Asosiy tovardan ayirish
                await tx.product.update({
                    where: { id: productId },
                    data: {
                        quantity: { decrement: qtyToDecrease }
                    }
                });
            }
        });

        res.json({ success: true, message: "Tovarlar ombordan ayirildi" });
    } catch (error) {
        console.error("❌ QAYTIM XATOSI:", error);
        
        // 5-HIMOYA: Agar xato o'zimiz yozgan "Xato:" so'zi bilan boshlansa, uni frontendga aniq qilib yuboramiz
        if (error.message.startsWith("Xato:")) {
            return res.status(400).json({ error: error.message });
        }

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















