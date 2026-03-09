import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const uzbData = [
  {
    name: "Toshkent shahri",
    districts: ["Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Olmazor", "Uchtepa", "Yashnobod", "Yakkasaroy", "Mirobod", "Bektemir", "Sergeli", "Shayxontohur", "Yangihayot"]
  },
  {
    name: "Toshkent viloyati",
    districts: ["Zangiota", "Qibray", "Yangiyo'l", "Chirchiq", "Olmaliq", "Angren", "Bo'stonliq", "Parkent", "Quyichirchiq", "O'rtachirchiq", "Yuqorichirchiq", "Piskent", "Oqqo'rg'on", "Ohangaron", "Chinoz", "Bekobod"]
  },
  {
    name: "Andijon viloyati",
    districts: ["Andijon shahri", "Asaka", "Shahrixon", "Oltinko'l", "Baliqchi", "Izboskan", "Jalaquduq", "Marhamat", "Paxtaobod", "Xo'jaobod", "Qo'rg'ontepa"]
  },
  {
    name: "Buxoro viloyati",
    districts: ["Buxoro shahri", "G'ijduvon", "Vobkent", "Shofirkon", "Kogon", "Romitan", "Peshku", "Jondor", "Qorako'l", "Olot", "Qorovulbozor"]
  },
  {
    name: "Farg'ona viloyati",
    districts: ["Farg'ona shahri", "Marg'ilon", "Qo'qon", "Oltiariq", "Qo'shtepa", "Rishton", "Bag'dod", "Uchko'prik", "Buvayda", "Dang'ara", "Farg'ona tumani", "Quva", "Toshloq"]
  },
  {
    name: "Jizzax viloyati",
    districts: ["Jizzax shahri", "Zomin", "G'allaorol", "Sharof Rashidov", "Do'stlik", "Paxtakor", "Mirzacho'l", "Zafarobod", "Zarbdor", "Arnasoy", "Forish", "Baxmal"]
  },
  {
    name: "Namangan viloyati",
    districts: ["Namangan shahri", "Chust", "Kosonsoy", "To'raqo'rg'on", "Uychi", "Namangan tumani", "Yangiqo'rg'on", "Chortoq", "Pop", "Uchqo'rg'on", "Mingbuloq"]
  },
  {
    name: "Navoiy viloyati",
    districts: ["Navoiy shahri", "Zarafshon", "Karmana", "Qiziltepa", "Xatirchi", "Navbahor", "Nurota", "Tomdi", "Uchquduq", "Konimex"]
  },
  {
    name: "Qashqadaryo viloyati",
    districts: ["Qarshi shahri", "Shaxrisabz", "Kitob", "Qamashi", "Koson", "G'uzor", "Chiroqchi", "Yakkabog'", "Muborak", "Kasbi", "Nishon", "Mirishkor"]
  },
  {
    name: "Samarqand viloyati",
    districts: ["Samarqand shahri", "Urgut", "Ishtixon", "Kattaqo'rg'on", "Pastdarg'om", "Narpay", "Bulung'ur", "Jomboy", "Payariq", "Samarqand tumani", "Tayloq", "Qo'shrabot"]
  },
  {
    name: "Sirdaryo viloyati",
    districts: ["Guliston shahri", "Yangiyer", "Sirdaryo", "Boyovut", "Oqoltin", "Sayxunobod", "Sardoba", "Shirin", "Xavos", "Mirzaobod"]
  },
  {
    name: "Surxondaryo viloyati",
    districts: ["Termiz shahri", "Denov", "Sherobod", "Boysun", "Qumqo'rg'on", "Sariosiyo", "Sho'rchi", "Angor", "Muzrabot", "Jarqo'rg'on", "Uzun", "Oltinsoy"]
  },
  {
    name: "Xorazm viloyati",
    districts: ["Urganch shahri", "Xiva", "Xonqa", "Hazorasp", "Shovot", "Gurlan", "Qo'shko'pir", "Yangiariq", "Yangibozor", "Bog'ot", "Tuproqqal'a"]
  },
  {
    name: "Qoraqalpog'iston Resp.",
    districts: ["Nukus shahri", "Qo'ng'irot", "Beruniy", "To'rtko'l", "Amudaryo", "Xo'jayli", "Taxiatosh", "Chimboy", "Kegeyli", "Qonliko'l", "Nukus tumani", "Qorao'zak", "Taxtako'pir", "Mo'ynoq"]
  }
];

async function main() {
  console.log("⏳ Baza tekshirilmoqda...");
  
  // Avval bazada ma'lumot bor-yo'qligini tekshiramiz (qayta-qayta yozib yubormasligi uchun)
  const existingRegions = await prisma.region.count();
  
  if (existingRegions > 0) {
    console.log("❌ Diqqat: Bazada viloyatlar allaqachon mavjud! Dastur to'xtatildi.");
    return;
  }

  console.log("🚀 Viloyat va tumanlarni bazaga yozish boshlandi...");

  for (const region of uzbData) {
    await prisma.region.create({
      data: {
        name: region.name,
        districts: {
          create: region.districts.map(districtName => ({ name: districtName }))
        }
      }
    });
    console.log(`✅ ${region.name} qo'shildi.`);
  }

  console.log("🎉 BARCHA MA'LUMOTLAR MUVAFFAQIYATLI SAQLANDI!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
