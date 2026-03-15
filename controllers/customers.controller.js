import { prisma } from '../lib/prisma.js';

const toUpperName = (value) => {
  if (value === null || value === undefined) return value;
  return String(value).trim().toUpperCase();
};

// 1. Yangi mijoz qo'shish
export const createCustomer = async (req, res) => {
  try {
    const data = req.body;

    const newCustomer = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: toUpperName(data.firstName),
          lastName: toUpperName(data.lastName),
          middleName: toUpperName(data.middleName),
          gender: data.gender,
          dob: new Date(data.dob),
          pinfl: data.pinfl,
          note: data.note
        }
      });

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

      if (data.phones && data.phones.length > 0) {
        await tx.customerPhone.createMany({
          data: data.phones.map((p) => ({
            customerId: customer.id,
            name: p.name,
            phone: p.phone,
            isMain: p.isMain || false
          }))
        });
      }

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
      return res.status(400).json({
        error: "Bu JSHSHIR raqamli mijoz allaqachon mavjud!"
      });
    }

    res.status(500).json({ error: "Server xatosi" });
  }
};

// 2. Barcha mijozlarni olish / qidirish
export const getCustomers = async (req, res) => {
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
    where.document = {
      ...where.document,
      series: { contains: passportSeries, mode: 'insensitive' }
    };
  }

  if (passportNumber) {
    where.document = {
      ...where.document,
      number: { contains: passportNumber }
    };
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
      { middleName: { contains: search, mode: 'insensitive' } },
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
    console.error("Mijozlarni olishda xatolik:", error);
    res.status(500).json({ error: "Qidirishda xatolik" });
  }
};

// 3. Bitta mijozni olish
export const getCustomerById = async (req, res) => {
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
    console.error("Bitta mijozni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
};

// 4. Mijozni yangilash
export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const customerId = Number(id);

  try {
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: toUpperName(data.firstName),
          lastName: toUpperName(data.lastName),
          middleName: toUpperName(data.middleName),
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
          data: data.phones.map((p) => ({
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
    console.error("Mijozni yangilashda xatolik:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: "Bu JSHSHIR raqam boshqa mijozga tegishli!"
      });
    }

    res.status(500).json({ error: "Server xatosi" });
  }
};

// 5. Mijozni o'chirish
export const deleteCustomer = async (req, res) => {
  const customerId = Number(req.params.id);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customerDocument.deleteMany({ where: { customerId } });
      await tx.customerAddress.deleteMany({ where: { customerId } });
      await tx.customerPhone.deleteMany({ where: { customerId } });
      await tx.customerJob.deleteMany({ where: { customerId } });

      await tx.customer.delete({ where: { id: customerId } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Mijozni o'chirishda xatolik:", error);

    if (error.code === 'P2003') {
      return res.status(400).json({
        error: "Bu mijozni o'chirib bo'lmaydi! Uning nomida savdo yoki shartnomalar mavjud."
      });
    }

    res.status(500).json({ error: "O'chirishda xatolik yuz berdi" });
  }
};

// 6. Hududlarni olish
export const getRegions = async (req, res) => {
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
};