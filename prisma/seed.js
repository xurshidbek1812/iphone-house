import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const regions = [
  {
    name: 'Andijon',
    districts: ['Andijon shahri']
  },
  {
    name: 'Buxoro',
    districts: ['Buxoro shahri']
  },
  {
    name: 'Fargʻona',
    districts: ['Fargʻona shahri']
  },
  {
    name: 'Jizzax',
    districts: ['Jizzax shahri']
  },
  {
    name: 'Xorazm',
    districts: ['Urganch shahri']
  },
  {
    name: 'Namangan',
    districts: ['Namangan shahri']
  },
  {
    name: 'Navoiy',
    districts: ['Navoiy shahri']
  },
  {
    name: 'Qashqadaryo',
    districts: ['Qarshi shahri']
  },
  {
    name: 'Qoraqalpogʻiston Respublikasi',
    districts: ['Nukus shahri']
  },
  {
    name: 'Samarqand',
    districts: ['Samarqand shahri']
  },
  {
    name: 'Sirdaryo',
    districts: ['Guliston shahri']
  },
  {
    name: 'Surxondaryo',
    districts: ['Termiz shahri']
  },
  {
    name: 'Toshkent viloyati',
    districts: ['Nurafshon shahri']
  },
  {
    name: 'Toshkent shahri',
    districts: [
      'Bektemir tumani',
      'Chilonzor tumani',
      'Mirobod tumani',
      'Mirzo Ulugʻbek tumani',
      'Olmazor tumani',
      'Sergeli tumani',
      'Shayxontohur tumani',
      'Uchtepa tumani',
      'Yakkasaroy tumani',
      'Yashnobod tumani',
      'Yunusobod tumani',
      'Yangi Hayot tumani'
    ]
  }
];

async function main() {
  console.log('Seed boshlandi...');

  for (const regionData of regions) {
    let region = await prisma.region.findFirst({
      where: {
        name: regionData.name
      }
    });

    if (!region) {
      region = await prisma.region.create({
        data: {
          name: regionData.name
        }
      });
    }

    for (const districtName of regionData.districts) {
      const existingDistrict = await prisma.district.findFirst({
        where: {
          name: districtName,
          regionId: region.id
        }
      });

      if (!existingDistrict) {
        await prisma.district.create({
          data: {
            name: districtName,
            regionId: region.id
          }
        });
      }
    }
  }

  console.log('Seed muvaffaqiyatli tugadi.');
}

main()
  .catch((e) => {
    console.error('Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });