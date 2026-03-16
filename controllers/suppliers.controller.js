import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: 'desc' }
    });

    res.json(suppliers);
  } catch (error) {
    console.error("Ta'minotchilarni olishda xatolik:", error);
    res.status(500).json({ error: "Xatolik" });
  }
};

export const createSupplier = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.SUPPLIER_MANAGE)) {
    return res.status(403).json({
      error: "Sizda ta'minotchi qo'shish huquqi yo'q!"
    });
  }

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
};

export const updateSupplier = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.SUPPLIER_MANAGE)) {
    return res.status(403).json({
      error: "Sizda ta'minotchini tahrirlash huquqi yo'q!"
    });
  }

  try {
    const supplierId = Number(req.params.id);
    const { customId, name, phone, address } = req.body;

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!existingSupplier) {
      return res.status(404).json({
        error: "Ta'minotchi topilmadi!"
      });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        customId: customId ?? existingSupplier.customId,
        name: name?.trim() || existingSupplier.name,
        phone: phone ?? existingSupplier.phone,
        address: address ?? existingSupplier.address
      }
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error("Ta'minotchini tahrirlashda xato:", error);
    res.status(500).json({
      error: "Ta'minotchini tahrirlashda xatolik"
    });
  }
};

export const deleteSupplier = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.SUPPLIER_MANAGE)) {
    return res.status(403).json({
      error: "Sizda ta'minotchini o'chirish huquqi yo'q!"
    });
  }

  try {
    await prisma.supplier.delete({
      where: { id: Number(req.params.id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Ta'minotchini o'chirishda xato:", error);
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
};