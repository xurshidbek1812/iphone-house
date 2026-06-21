import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { logActivity } from '../utils/activityLog.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'desc' }
    });

    res.json(categories);
  } catch (error) {
    console.error("Kategoriyalarni olishda xatolik:", error);
    res.status(500).json({ error: "Server xatosi yuz berdi" });
  }
};

export const createCategory = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CATEGORY_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kategoriya qo'shish huquqi yo'q!"
    });
  }

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

    try {
      await logActivity(prisma, {
        actor: req.user,
        action: 'CREATE',
        entityType: 'Category',
        entityId: category.id,
        entityLabel: category.name
      });
    } catch (logError) {
      console.error("Kategoriya qo'shish logini yozishda xatolik:", logError);
    }

    res.json(category);
  } catch (error) {
    console.error("Kategoriya qo'shishda xatolik:", error);
    res.status(500).json({
      error: "Kategoriya qo'shishda server xatosi yuz berdi"
    });
  }
};

export const updateCategory = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CATEGORY_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kategoriyani tahrirlash huquqi yo'q!"
    });
  }

  const categoryId = Number(req.params.id);
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "Kategoriya nomi kiritilmadi!" });
  }

  try {
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      return res.status(404).json({
        error: "Kategoriya topilmadi!"
      });
    }

    const duplicateCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        },
        NOT: {
          id: categoryId
        }
      }
    });

    if (duplicateCategory) {
      return res.status(400).json({
        error: "Bu kategoriya nomi allaqachon mavjud!"
      });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: name.trim()
      }
    });

    try {
      await logActivity(prisma, {
        actor: req.user,
        action: 'UPDATE',
        entityType: 'Category',
        entityId: updatedCategory.id,
        entityLabel: updatedCategory.name
      });
    } catch (logError) {
      console.error("Kategoriyani tahrirlash logini yozishda xatolik:", logError);
    }

    res.json(updatedCategory);
  } catch (error) {
    console.error("Kategoriyani tahrirlashda xatolik:", error);
    res.status(500).json({
      error: "Kategoriyani tahrirlashda server xatosi yuz berdi"
    });
  }
};

export const deleteCategory = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.CATEGORY_MANAGE)) {
    return res.status(403).json({
      error: "Sizda kategoriyani o'chirish huquqi yo'q!"
    });
  }

  try {
    const categoryId = Number(req.params.id);

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    await prisma.category.delete({
      where: { id: categoryId }
    });

    try {
      await logActivity(prisma, {
        actor: req.user,
        action: 'DELETE',
        entityType: 'Category',
        entityId: categoryId,
        entityLabel: existingCategory?.name || null
      });
    } catch (logError) {
      console.error("Kategoriyani o'chirish logini yozishda xatolik:", logError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Kategoriyani o'chirishda xato:", error);
    res.status(400).json({
      error: "Bu kategoriyani o'chirib bo'lmaydi. Unga ulangan tovarlar mavjud!"
    });
  }
};