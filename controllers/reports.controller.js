import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';

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