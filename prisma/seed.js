import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const regionsData = [
  {
    name: "Toshkent shahri",
    districts: [
      "Bektemir tumani", "Chilonzor tumani", "Mirobod tumani", "Mirzo Ulug'bek tumani",
      "Olmazor tumani", "Sergeli tumani", "Shayxontohur tumani", "Uchtepa tumani",
      "Yakkasaroy tumani", "Yashnobod tumani", "Yunusobod tumani", "Yangihayot tumani"
    ]
  },
  {
    name: "Toshkent viloyati",
    districts: [
      "Angren shahri", "Bekobod shahri", "Chirchiq shahri", "Olmaliq shahri", "Oqqo'rg'on tumani",
      "Ohangaron tumani", "Bekobod tumani", "Bo'stonliq tumani", "Buka tumani", "Qibray tumani",
      "Quyichirchiq tumani", "Parkent tumani", "Piskent tumani", "Zangiota tumani",
      "O'rta Chirchiq tumani", "Chinoz tumani", "Yangiyo'l tumani", "Toshkent tumani"
    ]
  },
  {
    name: "Andijon viloyati",
    districts: [
      "Andijon shahri", "Asaka shahri", "Andijon tumani", "Asaka tumani", "Baliqchi tumani",
      "Bo'z tumani", "Buloqboshi tumani", "Jalaquduq tumani", "Izboskan tumani",
      "Qo'rg'ontepa tumani", "Marhamat tumani", "Oltinko'l tumani", "Paxtaobod tumani",
      "Shahrixon tumani", "Xo'jaobod tumani"
    ]
  },
  {
    name: "Buxoro viloyati",
    districts: [
      "Buxoro shahri", "Kogon shahri", "Buxoro tumani", "Vobkent tumani", "Jondor tumani",
      "Kogon tumani", "Olot tumani", "Peshku tumani", "Qorako'l tumani", "Qorovulbozor tumani",
      "Romitan tumani", "Shofirkon tumani", "G'ijduvon tumani"
    ]
  },
  {
    name: "Farg'ona viloyati",
    districts: [
      "Farg'ona shahri", "Marg'ilon shahri", "Qo'qon shahri", "Quvasoy shahri",
      "Beshariq tumani", "Bog'dod tumani", "Buvayda tumani", "Dang'ara tumani",
      "Yozyovon tumani", "Oltiariq tumani", "Qo'shtepa tumani", "Rishton tumani",
      "So'x tumani", "Toshloq tumani", "Uchko'prik tumani", "Farg'ona tumani",
      "Furqat tumani", "O'zbekiston tumani", "Quva tumani"
    ]
  },
  {
    name: "Jizzax viloyati",
    districts: [
      "Jizzax shahri", "Arnasoy tumani", "Baxmal tumani", "Do'stlik tumani",
      "Forish tumani", "G'allaorol tumani", "Sharof Rashidov tumani", "Mirzacho'l tumani",
      "Paxtakor tumani", "Yangiobod tumani", "Zomin tumani", "Zafarobod tumani", "Zarbdor tumani"
    ]
  },
  {
    name: "Xorazm viloyati",
    districts: [
      "Urganch shahri", "Xiva shahri", "Bog'ot tumani", "Gurlan tumani",
      "Qo'shko'pir tumani", "Shovot tumani", "Urganch tumani", "Xiva tumani",
      "Xonqa tumani", "Hazorasp tumani", "Yangiariq tumani", "Yangibozor tumani", "Tuproqqal'a tumani"
    ]
  },
  {
    name: "Namangan viloyati",
    districts: [
      "Namangan shahri", "Chortoq tumani", "Chust tumani", "Kosonsoy tumani",
      "Mingbuloq tumani", "Namangan tumani", "Norin tumani", "Pop tumani",
      "To'raqo'rg'on tumani", "Uchqo'rg'on tumani", "Uychi tumani", "Yangiqo'rg'on tumani", "Davlatobod tumani"
    ]
  },
  {
    name: "Navoiy viloyati",
    districts: [
      "Navoiy shahri", "Zarafshon shahri", "Karmana tumani", "Konimex tumani",
      "Qiziltepa tumani", "Navbahor tumani", "Nurota tumani", "Tomdi tumani",
      "Uchquduq tumani", "Xatirchi tumani"
    ]
  },
  {
    name: "Qashqadaryo viloyati",
    districts: [
      "Qarshi shahri", "Shahrisabz shahri", "Dehqonobod tumani", "Kasbi tumani",
      "Kitob tumani", "Koson tumani", "Mirishkor tumani", "Muborak tumani",
      "Nishon tumani", "Qamashi tumani", "Qarshi tumani", "Shahrisabz tumani",
      "Yakkabog' tumani", "G'uzor tumani", "Chiroqchi tumani", "Ko'kdala tumani"
    ]
  },
  {
    name: "Qoraqalpog'iston Respublikasi",
    districts: [
      "Nukus shahri", "Amudaryo tumani", "Beruniy tumani", "Chimboy tumani",
      "Ellikqal'a tumani", "Kegeyli tumani", "Mo'ynoq tumani", "Nukus tumani",
      "Qanliko'l tumani", "Qo'ng'irot tumani", "Qorao'zak tumani", "Shumanay tumani",
      "Taxiatosh tumani", "Taxtako'pir tumani", "To'rtko'l tumani", "Xo'jayli tumani", "Bo'zatov tumani"
    ]
  },
  {
    name: "Samarqand viloyati",
    districts: [
      "Samarqand shahri", "Kattaqo'rg'on shahri", "Bulung'ur tumani", "Ishtixon tumani",
      "Jomboy tumani", "Kattaqo'rg'on tumani", "Narpay tumani", "Nurobod tumani",
      "Oqdaryo tumani", "Paxtachi tumani", "Payariq tumani", "Pastdarg'om tumani",
      "Qo'shrabot tumani", "Samarqand tumani", "Toyloq tumani", "Urgut tumani"
    ]
  },
  {
    name: "Sirdaryo viloyati",
    districts: [
      "Guliston shahri", "Shirin shahri", "Yangiyer shahri", "Boyovut tumani",
      "Guliston tumani", "Mirzaobod tumani", "Oqoltin tumani", "Sardoba tumani",
      "Sayxunobod tumani", "Sirdaryo tumani", "Xovos tumani"
    ]
  },
  {
    name: "Surxondaryo viloyati",
    districts: [
      "Termiz shahri", "Angor tumani", "Bandixon tumani", "Boysun tumani",
      "Denov tumani", "Jarqo'rg'on tumani", "Muzrabot tumani", "Oltinsoy tumani",
      "Qiziriq tumani", "Qumqo'rg'on tumani", "Sariosiyo tumani", "Sherobod tumani",
      "Sho'rchi tumani", "Termiz tumani", "Uzun tumani"
    ]
  }
];

async function main() {
  console.log('🌱 Ma\'lumotlar kiritilmoqda...');

  // 1. Adminni tekshirish va yaratish
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: { fullName: 'Bosh Administrator', username: 'admin', password: '123', role: 'ADMIN' }
    });
    console.log('✅ Admin user yaratildi');
  }

  // 2. Viloyat va Tumanlarni kiritish
  for (const region of regionsData) {
    const createdRegion = await prisma.region.create({
      data: {
        name: region.name,
        districts: {
          create: region.districts.map(distName => ({
            name: distName,
            // MFY lar juda ko'p bo'lgani uchun, faqat namunaviy MFY qo'shamiz
            // Haqiqiy loyihada buni admin panel orqali qo'shish kerak bo'ladi
            mfys: {
              create: [
                { name: "Markaziy MFY" },
                { name: "Do'stlik MFY" },
                { name: "Istiqlol MFY" }
              ]
            }
          }))
        }
      }
    });
    console.log(`📍 ${createdRegion.name} qo'shildi`);
  }

  console.log('✅ Barcha hududlar muvaffaqiyatli yuklandi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });