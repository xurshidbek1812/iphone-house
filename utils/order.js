export const generateOrderNumber = async (tx) => {
  while (true) {
    const number = String(Math.floor(10000 + Math.random() * 90000));

    const existing = await tx.order.findUnique({
      where: { orderNumber: number }
    });

    if (!existing) {
      return number;
    }
  }
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

export const allocateStockFIFO = async (tx, productId, requestedQty, preferredBatchId = null) => {
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

  // Agar ishchi aniq batch tanlagan bo'lsa, aynan o'sha batchdan olamiz
  if (preferredBatchId) {
    const selectedBatch = await tx.productBatch.findFirst({
      where: {
        id: Number(preferredBatchId),
        productId: Number(productId),
        isArchived: false
      }
    });

    if (!selectedBatch) {
      throw new Error("Xato: Tanlangan partiya topilmadi!");
    }

    if (Number(selectedBatch.quantity) < qty) {
      throw new Error("Xato: Tanlangan partiyada yetarli qoldiq yo'q!");
    }

    return {
      product,
      allocations: [
        {
          batchId: selectedBatch.id,
          quantity: qty,
          unitCost: Number(selectedBatch.buyPrice || 0),
          unitPrice: Number(selectedBatch.salePrice || product.salePrice || 0)
        }
      ]
    };
  }

  // Batch tanlanmagan bo'lsa FIFO ishlaydi
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