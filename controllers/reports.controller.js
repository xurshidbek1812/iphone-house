import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';

const parseDateRange = (from, to) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  return { fromDate, toDate };
};

const formatDateDots = (date) => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
};

const formatDateTimeDots = (date) => {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateDots(date)} ${h}:${min}`;
};

const getCustomerFullName = (customer) => {
  if (!customer) return '';
  return [customer.lastName, customer.firstName, customer.middleName]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const styleReportSheet = (worksheet, columns) => {
  worksheet.columns = columns;

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E40AF' }
  };
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
};

const addReportRows = (worksheet, rows) => {
  rows.forEach((row, index) => {
    const excelRow = worksheet.addRow({ index: index + 1, ...row });

    excelRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'E5E7EB' } },
        left: { style: 'thin', color: { argb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
        right: { style: 'thin', color: { argb: 'E5E7EB' } }
      };
    });
  });
};

const sendWorkbook = async (res, workbook, fileName) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  return res.end();
};

export const exportWarehouseStockReport = async (req, res) => {
  try {
    const { date, format } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Sana tanlanmagan!' });
    }

    const reportDate = new Date(date);

    if (Number.isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: "Sana noto'g'ri formatda!" });
    }

    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const products = await prisma.product.findMany({
        include: {
            batches: {
            where: {
                createdAt: {
                lte: endOfDay
                },
                isArchived: false
            },
            orderBy: {
                createdAt: 'asc'
            }
            }
        },
        orderBy: {
            id: 'asc'
        }
    });

    const rows = products
      .map((product) => {
        const validBatches = Array.isArray(product.batches) ? product.batches : [];

        const totalQuantity = validBatches.reduce(
          (sum, batch) => sum + Number(batch.quantity || 0),
          0
        );

        const totalBuyValueUZS = validBatches.reduce((sum, batch) => {
          const qty = Number(batch.quantity || 0);
          const buyPrice = Number(batch.buyPrice || 0);
          const currency = batch.buyCurrency || 'UZS';
          const rate = Number(batch.exchangeRate || 1);

          const buyPriceUZS = currency === 'USD' ? buyPrice * rate : buyPrice;
          return sum + qty * buyPriceUZS;
        }, 0);

        const salePriceUZS = Number(product.salePrice || 0);
        const totalSaleValueUZS = totalQuantity * salePriceUZS;

        return {
          productId: product.id,
          customId: product.customId || '',
          name: product.name || '',
          category: product.category || '',
          unit: product.unit || 'Dona',
          quantity: totalQuantity,
          salePriceUZS,
          totalBuyValueUZS,
          totalSaleValueUZS,
          batchCount: validBatches.length
        };
      })
      .filter((row) => row.quantity > 0);

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tovarlar qoldig‘i');

      worksheet.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Mahsulot ID', key: 'productId', width: 14 },
        { header: 'Custom ID', key: 'customId', width: 14 },
        { header: 'Mahsulot nomi', key: 'name', width: 38 },
        { header: 'Kategoriya', key: 'category', width: 22 },
        { header: 'Birlik', key: 'unit', width: 12 },
        { header: 'Qoldiq soni', key: 'quantity', width: 14 },
        { header: 'Sotuv narxi (UZS)', key: 'salePriceUZS', width: 18 },
        { header: 'Jami kirim qiymati (UZS)', key: 'totalBuyValueUZS', width: 22 },
        { header: 'Jami sotuv qiymati (UZS)', key: 'totalSaleValueUZS', width: 22 },
        { header: 'Partiyalar soni', key: 'batchCount', width: 16 }
      ];

      const titleRow = worksheet.addRow([
        `Tovarlar qoldig'i hisoboti - ${date}`
      ]);
      titleRow.font = { bold: true, size: 14 };
      worksheet.mergeCells(`A${titleRow.number}:K${titleRow.number}`);

      worksheet.addRow([]);

      const headerRow = worksheet.addRow(
        worksheet.columns.map((col) => col.header)
      );

      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E40AF' }
      };
      headerRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      rows.forEach((row, index) => {
        const excelRow = worksheet.addRow({
          index: index + 1,
          ...row
        });

        excelRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'E5E7EB' } },
            left: { style: 'thin', color: { argb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
            right: { style: 'thin', color: { argb: 'E5E7EB' } }
          };
        });
      });

      worksheet.getColumn('quantity').numFmt = '#,##0';
      worksheet.getColumn('salePriceUZS').numFmt = '#,##0';
      worksheet.getColumn('totalBuyValueUZS').numFmt = '#,##0';
      worksheet.getColumn('totalSaleValueUZS').numFmt = '#,##0';
      worksheet.getColumn('batchCount').numFmt = '#,##0';

      worksheet.views = [{ state: 'frozen', ySplit: 3 }];

      const fileName = `tovarlar-qoldigi-${date}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    return res.json({
      success: true,
      date,
      count: rows.length,
      items: rows
    });
  } catch (error) {
    console.error('exportWarehouseStockReport xatosi:', error);
    return res.status(500).json({
      error: "Tovarlar qoldig'i hisobotini yaratishda xatolik yuz berdi"
    });
  }
};

export const exportCashIncomeReport = async (req, res) => {
  try {
    const { from, to, format } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Sana oraligʻi tanlanmagan!' });
    }

    const range = parseDateRange(from, to);
    if (!range) {
      return res.status(400).json({ error: "Sana noto'g'ri formatda!" });
    }

    const payments = await prisma.payment.findMany({
      where: {
        direction: 'IN',
        status: 'POSTED',
        paidAt: { gte: range.fromDate, lte: range.toDate }
      },
      include: {
        order: { include: { customer: true } },
        contract: { include: { customer: true } },
        cashbox: true,
        user: true
      },
      orderBy: { paidAt: 'asc' }
    });

    const rows = payments.map((payment) => {
      const isContract = Boolean(payment.contractId);
      const customer = isContract ? payment.contract?.customer : payment.order?.customer;
      const customerName =
        getCustomerFullName(customer) || payment.order?.otherName || '';

      return {
        customerName,
        docNumber: isContract
          ? payment.contract?.contractNumber || ''
          : payment.order?.orderNumber || '',
        type: isContract ? 'Shartnoma' : 'Naqd savdo',
        amount: Number(payment.amount || 0),
        cashbox: payment.cashbox?.name || '',
        paidDate: formatDateDots(payment.paidAt),
        cashier: payment.user?.fullName || '',
        note: payment.note || '',
        confirmedAt: formatDateTimeDots(payment.paidAt)
      };
    });

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Barcha tushumlar');

      styleReportSheet(worksheet, [
        { header: '№', key: 'index', width: 6 },
        { header: 'Mijoz F.I.O', key: 'customerName', width: 34 },
        { header: 'ID', key: 'docNumber', width: 12 },
        { header: 'Turi', key: 'type', width: 14 },
        { header: 'Summa', key: 'amount', width: 16 },
        { header: 'Kassa', key: 'cashbox', width: 20 },
        { header: "To'lov kuni", key: 'paidDate', width: 14 },
        { header: 'Kassir', key: 'cashier', width: 20 },
        { header: 'Izoh', key: 'note', width: 30 },
        { header: 'Tasdiqlangan sana', key: 'confirmedAt', width: 18 }
      ]);

      addReportRows(worksheet, rows);
      worksheet.getColumn('amount').numFmt = '#,##0';

      const fileName = `R0002-${from.split('-').reverse().join('.')}-${to
        .split('-')
        .reverse()
        .join('.')}.xlsx`;

      return sendWorkbook(res, workbook, fileName);
    }

    return res.json({
      success: true,
      from,
      to,
      count: rows.length,
      items: rows
    });
  } catch (error) {
    console.error('exportCashIncomeReport xatosi:', error);
    return res.status(500).json({
      error: 'Tushumlar hisobotini yaratishda xatolik yuz berdi'
    });
  }
};

export const exportExpensesReport = async (req, res) => {
  try {
    const { from, to, format } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Sana oraligʻi tanlanmagan!' });
    }

    const range = parseDateRange(from, to);
    if (!range) {
      return res.status(400).json({ error: "Sana noto'g'ri formatda!" });
    }

    const expenses = await prisma.expense.findMany({
      where: {
        status: 'Tasdiqlandi',
        approvedAt: { gte: range.fromDate, lte: range.toDate }
      },
      include: {
        expenseCategory: { include: { group: true } },
        cashbox: true,
        createdBy: true
      },
      orderBy: { approvedAt: 'asc' }
    });

    const rows = expenses.map((expense) => ({
      expenseId: expense.id,
      date: formatDateDots(expense.approvedAt || expense.createdAt),
      categoryGroup: expense.expenseCategory?.group?.name || '',
      categoryName: expense.expenseCategory?.name || '',
      cashbox: expense.cashbox?.name || '',
      amount: Number(expense.amount || 0),
      staff: expense.createdBy?.fullName || '',
      note: expense.note || ''
    }));

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Xarajatlar');

      styleReportSheet(worksheet, [
        { header: '№', key: 'index', width: 6 },
        { header: 'Xarajat ID', key: 'expenseId', width: 12 },
        { header: 'Sana', key: 'date', width: 14 },
        { header: 'Xarajat guruhi', key: 'categoryGroup', width: 28 },
        { header: 'Xarajat nomi', key: 'categoryName', width: 34 },
        { header: 'Kassa', key: 'cashbox', width: 20 },
        { header: 'Summasi', key: 'amount', width: 16 },
        { header: 'Hodim', key: 'staff', width: 20 },
        { header: 'Izoh', key: 'note', width: 30 }
      ]);

      addReportRows(worksheet, rows);
      worksheet.getColumn('amount').numFmt = '#,##0';

      const fileName = `R0003-${from}~${to}.xlsx`;

      return sendWorkbook(res, workbook, fileName);
    }

    return res.json({
      success: true,
      from,
      to,
      count: rows.length,
      items: rows
    });
  } catch (error) {
    console.error('exportExpensesReport xatosi:', error);
    return res.status(500).json({
      error: 'Xarajatlar hisobotini yaratishda xatolik yuz berdi'
    });
  }
};