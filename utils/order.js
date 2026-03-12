export const generateOrderNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
};

export const getMainCashbox = async (tx, cashboxId) => {
  if (cashboxId) {
    const cashbox = await tx.cashbox.findUnique({
      where: { id: Number(cashboxId) }
    });

    if (!cashbox) {
      throw new Error("Xato: Tanlangan kassa topilmadi!");
    }

    return cashbox;
  }

  const mainCashbox = await tx.cashbox.findFirst({
    orderBy: { id: 'asc' }
  });

  if (!mainCashbox) {
    throw new Error("Xato: Tizimda kassa topilmadi! Avval kassa yarating.");
  }

  return mainCashbox;
};

export const allocateStockFIFO = async (tx, productId, requestedQty) => {
  const qty = Number(requestedQty);

  if (isNaN(qty) || qty <= 0) {
    throw new Error("Xato: So'ralgan miqdor noto'g'ri!");
  }

  const product = await tx.product.findUnique({
    where: { id: Number(productId) }
  });

  if (!product) {
    throw new Error(`Xato: ID ${productId} bo'lgan tovar topilmadi!`);
  }

  if (Number(product.quantity) < qty) {
    throw new Error(`Xato: ${product.name} tovaridan omborda yetarli qoldiq yo'q!`);
  }

  const batches = await tx.productBatch.findMany({
    where: {
      productId: Number(productId),
      isArchived: false,
      quantity: { gt: 0 }
    },
    orderBy: { createdAt: 'asc' }
  });

  let remaining = qty;
  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const available = Number(batch.quantity);
    if (available <= 0) continue;

    const taken = Math.min(available, remaining);

    allocations.push({
      batchId: batch.id,
      quantity: taken,
      unitCost: Number(batch.buyPrice || 0),
      unitPrice: Number(batch.salePrice || product.salePrice || 0)
    });

    remaining -= taken;
  }

  if (remaining > 0) {
    throw new Error(`Xato: ${product.name} uchun batchlar bo'yicha yetarli qoldiq topilmadi!`);
  }

  return { product, allocations };
};