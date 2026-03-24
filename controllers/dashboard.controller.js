import { prisma } from '../lib/prisma.js';

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDayLabel = (date) => {
  return date.toLocaleDateString('uz-UZ', { weekday: 'short' });
};

export const getDashboard = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chartDays.push({
        start: startOfDay(d),
        end: endOfDay(d),
        label: formatDayLabel(d)
      });
    }

    const [
      products,
      cashboxes,
      allContracts,
      allOrders,
      supplierInvoices,
      todayCompletedOrders,
      todayCreatedContracts,
      todayPayments,
      lowStockProducts,
      topProductRows,
      rawExpenses,
      pendingContracts,
      blacklistRequests
    ] = await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          quantity: true,
          buyPrice: true,
          salePrice: true,
          name: true,
          customId: true
        }
      }),

      prisma.cashbox.findMany({
        select: {
          id: true,
          name: true,
          balance: true,
          currency: true,
          isActive: true
        }
      }),

      prisma.contract.findMany({
        include: {
          customer: {
            include: {
              phones: true
            }
          },
          user: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          },
          payments: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),

      prisma.order.findMany({
        include: {
          customer: {
            include: {
              phones: true
            }
          },
          user: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          },
          payments: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),

      prisma.supplierInvoice.findMany({
        where: {
          status: {
            not: 'Tasdiqlandi'
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }),

      prisma.order.findMany({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd
          },
          status: 'COMPLETED'
        },
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true
        }
      }),

      prisma.contract.findMany({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        select: {
          id: true,
          totalAmount: true,
          debtAmount: true,
          status: true
        }
      }),

      prisma.payment.findMany({
        where: {
          paidAt: {
            gte: todayStart,
            lte: todayEnd
          },
          status: 'POSTED'
        },
        select: {
          id: true,
          amount: true,
          contractId: true,
          orderId: true,
          paidAt: true
        }
      }),

      prisma.product.findMany({
        where: {
          quantity: {
            lte: 3
          }
        },
        select: {
          id: true,
          name: true,
          customId: true,
          quantity: true,
          salePrice: true
        },
        orderBy: {
          quantity: 'asc'
        },
        take: 10
      }),

      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
          totalAmount: true
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 10
      }),

      prisma.expense.findMany({
        include: {
          cashbox: {
            select: {
              id: true,
              name: true,
              currency: true
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          },
          approvedBy: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          },
          expenseCategory: {
            include: {
              group: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 20
      }),

      prisma.contract.findMany({
        where: {
          status: 'PAYMENT_PENDING'
        },
        include: {
          customer: {
            include: {
              phones: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 20
      }),

      prisma.blacklistRequest.findMany({
        where: {
          status: 'Yuborildi'
        },
        include: {
          customer: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })
    ]);

    const topProducts = await Promise.all(
      topProductRows.map(async (row) => {
        const product = await prisma.product.findUnique({
          where: { id: row.productId },
          select: {
            id: true,
            customId: true,
            name: true
          }
        });

        return {
          productId: row.productId,
          customId: product?.customId || null,
          name: product?.name || "Noma'lum tovar",
          quantity: Number(row._sum.quantity || 0),
          totalAmount: Number(row._sum.totalAmount || 0)
        };
      })
    );

    const expenses = rawExpenses.map((exp) => ({
      id: exp.id,
      name:
        exp.expenseCategory?.group?.name && exp.expenseCategory?.name
          ? `${exp.expenseCategory.group.name} / ${exp.expenseCategory.name}`
          : exp.expenseCategory?.name ||
            exp.expenseType ||
            exp.note ||
            'Xarajat',
      amount: Number(exp.amount || 0),
      createdAt: exp.createdAt,
      status: exp.status,
      note: exp.note || '-',
      cashbox: exp.cashbox || null,
      user: {
        fullName: exp.createdBy?.fullName || null,
        username: exp.createdBy?.username || null
      },
      createdBy: exp.createdBy || null,
      approvedBy: exp.approvedBy || null
    }));

    const inventoryValue = products.reduce((sum, product) => {
      return sum + Number(product.quantity || 0) * Number(product.buyPrice || 0);
    }, 0);

    const totalIncome = cashboxes.reduce((sum, cashbox) => {
      return sum + Number(cashbox.balance || 0);
    }, 0);

    const totalDebt = allContracts.reduce((sum, contract) => {
      const paid = Array.isArray(contract.payments)
        ? contract.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
        : 0;

      const remain = Math.max(0, Number(contract.debtAmount || 0) - paid);
      return sum + remain;
    }, 0);

    const productCount = products.length;

    const todaySalesAmount = todayCompletedOrders.reduce((sum, order) => {
      return sum + Number(order.totalAmount || 0);
    }, 0);

    const todayContractsAmount = todayCreatedContracts.reduce((sum, contract) => {
      return sum + Number(contract.totalAmount || 0);
    }, 0);

    const todayPaymentsAmount = todayPayments.reduce((sum, payment) => {
      return sum + Number(payment.amount || 0);
    }, 0);

    const todayContractsCount = todayCreatedContracts.length;

    const allPaymentsFlat = [
      ...allOrders.flatMap((o) => o.payments || []),
      ...allContracts.flatMap((c) => c.payments || [])
    ];

    const chart = chartDays.map((day) => {
      const daySales = allOrders
        .filter((order) => {
          const createdAt = new Date(order.createdAt);
          return createdAt >= day.start && createdAt <= day.end;
        })
        .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

      const dayContracts = allContracts
        .filter((contract) => {
          const createdAt = new Date(contract.createdAt);
          return createdAt >= day.start && createdAt <= day.end;
        })
        .reduce((sum, contract) => sum + Number(contract.totalAmount || 0), 0);

      const dayPayments = allPaymentsFlat
        .filter((payment) => {
          if (!payment?.paidAt) return false;
          const paidAt = new Date(payment.paidAt);
          return paidAt >= day.start && paidAt <= day.end;
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return {
        name: day.label,
        sales: daySales,
        contracts: dayContracts,
        payments: dayPayments
      };
    });

    const contractNotifications = allContracts
      .filter((contract) => {
        const paid = Array.isArray(contract.payments)
          ? contract.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
          : 0;

        const remain = Math.max(0, Number(contract.debtAmount || 0) - paid);
        return remain > 0;
      })
      .slice(0, 10)
      .map((contract) => ({
        id: `contract-${contract.id}`,
        type: 'Shartnoma',
        supplier:
          `${contract.customer?.lastName || ''} ${contract.customer?.firstName || ''}`.trim() ||
          contract.contractNumber,
        sender: contract.user?.fullName || contract.user?.username || "Noma'lum",
        totalSum: Math.max(
          0,
          Number(contract.debtAmount || 0) -
            (Array.isArray(contract.payments)
              ? contract.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
              : 0)
        ),
        date: contract.createdAt,
        dateText: new Date(contract.createdAt).toLocaleString('uz-UZ'),
        isRead: false,
        status: "To'lov kutilmoqda"
      }));

    const orderNotifications = allOrders
      .filter((order) => Number(order.dueAmount || 0) > 0)
      .slice(0, 10)
      .map((order) => ({
        id: `order-${order.id}`,
        type: 'Savdo',
        supplier:
          `${order.customer?.lastName || ''} ${order.customer?.firstName || ''}`.trim() ||
          order.orderNumber,
        sender: order.user?.fullName || order.user?.username || "Noma'lum",
        totalSum: Number(order.dueAmount || 0),
        date: order.createdAt,
        dateText: new Date(order.createdAt).toLocaleString('uz-UZ'),
        isRead: false,
        status: "To'lov kutilmoqda"
      }));

    const supplierNotifications = supplierInvoices.map((invoice) => ({
      id: `supplier-${invoice.id}`,
      type: 'Kirim',
      supplier: invoice.supplierName || invoice.invoiceNumber || "Ta'minot hujjati",
      sender: invoice.userName || "Noma'lum",
      totalSum: Number(invoice.totalSum || 0),
      date: invoice.createdAt,
      dateText: new Date(invoice.createdAt).toLocaleString('uz-UZ'),
      isRead: false,
      status: invoice.status || 'Jarayonda'
    }));

    const blacklistNotifications = blacklistRequests.map((item) => ({
      id: `blacklist-${item.id}`,
      type: "Qora ro'yxat",
      supplier:
        `${item.customer?.lastName || ''} ${item.customer?.firstName || ''} ${item.customer?.middleName || ''}`.trim() ||
        `Mijoz #${item.customerId}`,
      sender: item.requesterName || "Noma'lum",
      totalSum: 0,
      date: item.createdAt,
      dateText: new Date(item.createdAt).toLocaleString('uz-UZ'),
      isRead: false,
      status: item.type === 'ADD' ? "Qo'shish so'rovi" : "Chiqarish so'rovi",
      requestStatus: item.status,
      reason: item.reason
    }));

    const notifications = [
      ...supplierNotifications,
      ...contractNotifications,
      ...orderNotifications,
      ...blacklistNotifications
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20)
      .map((item) => ({
        ...item,
        date: item.dateText
      }));

    return res.json({
      stats: {
        inventoryValue,
        totalIncome,
        totalDebt,
        productCount
      },
      today: {
        salesAmount: todaySalesAmount,
        contractsAmount: todayContractsAmount,
        paymentsAmount: todayPaymentsAmount,
        contractsCount: todayContractsCount
      },
      chart,
      lowStockProducts,
      cashboxes,
      notifications,
      topProducts,
      expenses,
      pendingContracts
    });
  } catch (error) {
    console.error("Dashboard ma'lumotlarini olishda xatolik:", error);
    return res.status(500).json({
      error: "Dashboard ma'lumotlarini olishda xatolik yuz berdi"
    });
  }
};