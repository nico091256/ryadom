import { PrismaClient, UserRole, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed City (Tashkent)
  const tashkent = await prisma.city.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name_uz: 'Toshkent',
      name_ru: 'Ташкент',
      name_en: 'Tashkent',
      is_active: true,
    },
  });
  console.log(`City seeded: ${tashkent.name_uz}`);

  // 2. Seed Admin User
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      name: 'Platform Administrator',
      password_hash: adminPasswordHash,
      role: UserRole.admin,
      language: 'uz',
      is_blocked: false,
    },
  });
  console.log(`Admin user seeded: ${admin.login}`);

  // 3. Seed Demo Shopkeeper User
  const sellerPasswordHash = await bcrypt.hash('Shopkeeper123!', 10);
  const seller = await prisma.user.upsert({
    where: { login: 'seller_chilonzor' },
    update: {},
    create: {
      login: 'seller_chilonzor',
      phone: '+998909876543',
      name: 'Bobur Shopkeeper',
      password_hash: sellerPasswordHash,
      role: UserRole.seller,
      language: 'uz',
      is_blocked: false,
      must_change_password: true, // As specified in TZ: must change password on first login
    },
  });
  console.log(`Shopkeeper user seeded: ${seller.login}`);

  // 4. Seed Customer User
  const customer = await prisma.user.upsert({
    where: { phone: '+998901234567' },
    update: {},
    create: {
      phone: '+998901234567',
      name: 'Sardor Aliyev',
      role: UserRole.customer,
      language: 'uz',
      is_blocked: false,
    },
  });
  console.log(`Customer user seeded: ${customer.phone}`);

  // 5. Seed Customer Address (~250 meters from demo shop)
  await prisma.address.deleteMany({ where: { user_id: customer.id } });
  const customerAddress = await prisma.address.create({
    data: {
      user_id: customer.id,
      city_id: tashkent.id,
      title: 'Uy',
      address_text: 'Toshkent sh., Chilonzor 5-mavze, 12-uy, 45-xonadon',
      lat: 41.2840,
      lng: 69.2160,
    },
  });
  console.log(`Customer address seeded: ${customerAddress.title} (${customerAddress.address_text})`);

  // 6. Seed Demo Shop ("Chilonzor Oziq-Ovqat")
  await prisma.shop.deleteMany({ where: { owner_id: seller.id } });
  const shop = await prisma.shop.create({
    data: {
      owner_id: seller.id,
      city_id: tashkent.id,
      name: 'Chilonzor Oziq-Ovqat',
      logo_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
      phone: '+998909876543',
      address_text: 'Toshkent sh., Chilonzor ko\'chasi, 28-do\'kon',
      lat: 41.2825,
      lng: 69.2150,
      open_time: '08:00',
      close_time: '23:00',
      is_open: true,
      is_active: true,
      commission_rate_percent: 0,
    },
  });
  console.log(`Shop seeded: ${shop.name}`);

  // 7. Seed Global Categories
  const categoriesData = [
    {
      name_uz: 'Non va pishiriqlar',
      name_ru: 'Хлеб и выпечка',
      name_en: 'Bakery & Bread',
      icon_url: 'bread-slice',
    },
    {
      name_uz: 'Sut va sut mahsulotlari',
      name_ru: 'Молочные продукты',
      name_en: 'Dairy Products',
      icon_url: 'glass-whiskey',
    },
    {
      name_uz: 'Ichimliklar va sharbatlar',
      name_ru: 'Напитки и соки',
      name_en: 'Beverages & Juices',
      icon_url: 'wine-bottle',
    },
    {
      name_uz: 'Meva va sabzavotlar',
      name_ru: 'Овощи и фрукты',
      name_en: 'Fruits & Vegetables',
      icon_url: 'apple-alt',
    },
    {
      name_uz: 'Shirinliklar va gazaklar',
      name_ru: 'Сладости и снеки',
      name_en: 'Sweets & Snacks',
      icon_url: 'cookie',
    },
  ];

  const categories = [];
  for (const catData of categoriesData) {
    const cat = await prisma.category.create({
      data: catData,
    });
    categories.push(cat);
  }
  console.log(`Categories seeded: ${categories.length}`);

  // 8. Seed Products for the Demo Shop
  // Note: Prices in tiyin (1 UZS = 100 tiyin)
  const productsData = [
    {
      shop_id: shop.id,
      category_id: categories[0].id,
      name_uz: 'Samarqand noni',
      name_ru: 'Самаркандская лепешка',
      name_en: 'Samarkand Flatbread',
      description_uz: 'Issiq va xushbo\'y an\'anaviy Samarqand tandir noni.',
      description_ru: 'Традиционная самаркандская лепешка из тандыра.',
      description_en: 'Fresh traditional Samarkand tandoor bread.',
      price: 800000, // 8,000 UZS
      stock: 45,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[0].id,
      name_uz: 'Buxanka oq non',
      name_ru: 'Формовой белый хлеб',
      name_en: 'White Loaf Bread',
      description_uz: 'Yumshoq, yangi yopilgan oliy navli oq non.',
      description_ru: 'Мягкий свежий белый хлеб высшего сорта.',
      description_en: 'Fresh soft white loaf bread.',
      price: 400000, // 4,000 UZS
      stock: 30,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[1].id,
      name_uz: 'Musaffo sut 3.2% 1L',
      name_ru: 'Молоко Musaffo 3.2% 1л',
      name_en: 'Musaffo Milk 3.2% 1L',
      description_uz: 'Pasterizatsiyalangan tabiiy sigir suti.',
      description_ru: 'Пастеризованное натуральное коровье молоко.',
      description_en: 'Pasteurized whole milk.',
      price: 1300000, // 13,000 UZS
      stock: 25,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[1].id,
      name_uz: 'Bio Smetana 20% 400g',
      name_ru: 'Сметана Bio 20% 400г',
      name_en: 'Sour Cream Bio 20% 400g',
      description_uz: 'Quyuq va mazali tabiiy smetana.',
      description_ru: 'Густая натуральная сметана.',
      description_en: 'Rich natural sour cream.',
      price: 1500000, // 15,000 UZS
      stock: 18,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[2].id,
      name_uz: 'Coca-Cola Classic 1.5L',
      name_ru: 'Coca-Cola Классическая 1.5л',
      name_en: 'Coca-Cola Classic 1.5L',
      description_uz: 'Gazlangan tetiklashtiruvchi ichimlik.',
      description_ru: 'Освежающий газированный напиток.',
      description_en: 'Refreshing carbonated soft drink.',
      price: 1400000, // 14,000 UZS
      stock: 50,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[2].id,
      name_uz: 'Hydrolife tog\' suvi 1.5L',
      name_ru: 'Горная вода Hydrolife 1.5л',
      name_en: 'Hydrolife Mountain Water 1.5L',
      description_uz: 'Toza gazsizlangan tog\' ichimlik suvi.',
      description_ru: 'Чистая негазированная горная вода.',
      description_en: 'Pure still mountain mineral water.',
      price: 500000, // 5,000 UZS
      stock: 80,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[3].id,
      name_uz: 'Qizil olma (1 kg)',
      name_ru: 'Яблоки красные (1 кг)',
      name_en: 'Red Apples (1 kg)',
      description_uz: 'Shirin va suvli mahalliy qizil olma.',
      description_ru: 'Сладкие сочные местные яблоки.',
      description_en: 'Sweet juicy local red apples.',
      price: 1600000, // 16,000 UZS
      stock: 40,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
    },
    {
      shop_id: shop.id,
      category_id: categories[3].id,
      name_uz: 'Yangi bodring (1 kg)',
      name_ru: 'Свежие огурцы (1 кг)',
      name_en: 'Fresh Cucumbers (1 kg)',
      description_uz: 'Qarsildoq yangi terilgan bodring.',
      description_ru: 'Хрустящие свежие грунтовые огурцы.',
      description_en: 'Crisp fresh cucumbers.',
      price: 1200000, // 12,000 UZS
      stock: 35,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=400&q=80',
    },
  ];

  for (const prodData of productsData) {
    await prisma.product.create({
      data: prodData,
    });
  }
  console.log(`Products seeded: ${productsData.length}`);

  // 9. Seed Additional Shops (mostly within 3 km of the demo customer, a few in other districts)
  const IMG = {
    shop: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
    bread: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
    loaf: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    cream: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=400&q=80',
    cola: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    water: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80',
    apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
    cucumber: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=400&q=80',
  };

  // [category index, uz, ru, en, price in UZS, image]
  type ProductTpl = [number, string, string, string, number, string | null];
  const catalog: Record<string, ProductTpl> = {
    nonSamarqand: [0, 'Samarqand noni', 'Самаркандская лепешка', 'Samarkand Flatbread', 8000, IMG.bread],
    nonOq: [0, 'Buxanka oq non', 'Формовой белый хлеб', 'White Loaf Bread', 4000, IMG.loaf],
    patir: [0, 'Patir non', 'Патыр', 'Patir Bread', 10000, IMG.bread],
    somsa: [0, 'Tandir somsa', 'Самса из тандыра', 'Tandoor Samsa', 7000, null],
    kruassan: [0, 'Kruassan', 'Круассан', 'Croissant', 9000, null],
    sut: [1, 'Musaffo sut 3.2% 1L', 'Молоко Musaffo 3.2% 1л', 'Musaffo Milk 3.2% 1L', 13000, IMG.milk],
    smetana: [1, 'Bio Smetana 20% 400g', 'Сметана Bio 20% 400г', 'Sour Cream Bio 20% 400g', 15000, IMG.cream],
    qatiq: [1, 'Qatiq 1L', 'Катык 1л', 'Katyk Yogurt 1L', 11000, IMG.milk],
    tvorog: [1, 'Tvorog 9% 500g', 'Творог 9% 500г', 'Cottage Cheese 9% 500g', 22000, null],
    pishloq: [1, 'Pishloq Gollandskiy 300g', 'Сыр Голландский 300г', 'Dutch Cheese 300g', 35000, null],
    cola: [2, 'Coca-Cola Classic 1.5L', 'Coca-Cola Классическая 1.5л', 'Coca-Cola Classic 1.5L', 14000, IMG.cola],
    suv: [2, "Hydrolife tog' suvi 1.5L", 'Горная вода Hydrolife 1.5л', 'Hydrolife Mountain Water 1.5L', 5000, IMG.water],
    sharbat: [2, "Bliss olma sharbati 1L", 'Яблочный сок Bliss 1л', 'Bliss Apple Juice 1L', 16000, null],
    choy: [2, "Ko'k choy 95-raqam 100g", 'Зелёный чай №95 100г', 'Green Tea No.95 100g', 12000, null],
    olma: [3, 'Qizil olma (1 kg)', 'Яблоки красные (1 кг)', 'Red Apples (1 kg)', 16000, IMG.apple],
    bodring: [3, 'Yangi bodring (1 kg)', 'Свежие огурцы (1 кг)', 'Fresh Cucumbers (1 kg)', 12000, IMG.cucumber],
    pomidor: [3, 'Pomidor (1 kg)', 'Помидоры (1 кг)', 'Tomatoes (1 kg)', 18000, null],
    banan: [3, 'Banan (1 kg)', 'Бананы (1 кг)', 'Bananas (1 kg)', 25000, null],
    kartoshka: [3, 'Kartoshka (1 kg)', 'Картофель (1 кг)', 'Potatoes (1 kg)', 6000, null],
    piyoz: [3, 'Piyoz (1 kg)', 'Лук (1 кг)', 'Onions (1 kg)', 5000, null],
    shokolad: [4, 'Snickers 50g', 'Snickers 50г', 'Snickers 50g', 9000, null],
    chips: [4, 'Lays chips 150g', 'Чипсы Lays 150г', 'Lays Chips 150g', 17000, null],
    pechenye: [4, 'Yubileynoe pechenyesi', 'Печенье Юбилейное', 'Yubileynoe Cookies', 11000, null],
    holva: [4, 'Kunjutli holva 250g', 'Кунжутная халва 250г', 'Sesame Halva 250g', 20000, null],
  };

  const extraShops = [
    { login: 'seller_bunyodkor', name: 'Bunyodkor Market', address: "Toshkent sh., Bunyodkor shoh ko'chasi, 14", lat: 41.2885, lng: 69.2205, open: '07:00', close: '23:59', logo: IMG.shop,
      items: ['nonSamarqand', 'sut', 'qatiq', 'cola', 'suv', 'olma', 'pomidor', 'kartoshka', 'shokolad', 'chips'] },
    { login: 'seller_novza', name: 'Novza Non Markazi', address: "Toshkent sh., Novza, Chilonzor ko'chasi, 3", lat: 41.2925, lng: 69.2230, open: '06:00', close: '21:00', logo: IMG.bread,
      items: ['nonSamarqand', 'nonOq', 'patir', 'somsa', 'kruassan', 'choy'] },
    { login: 'seller_qatortol', name: "Qatortol Meva-Sabzavot", address: "Toshkent sh., Qatortol ko'chasi, 21", lat: 41.2790, lng: 69.2050, open: '07:00', close: '22:00', logo: IMG.apple,
      items: ['olma', 'bodring', 'pomidor', 'banan', 'kartoshka', 'piyoz'] },
    { login: 'seller_sut', name: 'Sut Dunyosi', address: 'Toshkent sh., Chilonzor 9-mavze, 4-uy', lat: 41.2755, lng: 69.2190, open: '07:00', close: '22:00', logo: IMG.milk,
      items: ['sut', 'smetana', 'qatiq', 'tvorog', 'pishloq', 'nonOq'] },
    { login: 'seller_24', name: '24/7 Minimarket', address: "Toshkent sh., Muqimiy ko'chasi, 58", lat: 41.2950, lng: 69.2120, open: '00:00', close: '23:59', logo: IMG.cola,
      items: ['cola', 'suv', 'sharbat', 'chips', 'shokolad', 'pechenye', 'nonOq', 'sut'] },
    { login: 'seller_shirin', name: 'Shirin Lazzat', address: 'Toshkent sh., Chilonzor 2-mavze, 17-uy', lat: 41.2860, lng: 69.2010, open: '09:00', close: '22:00', logo: null,
      items: ['shokolad', 'pechenye', 'holva', 'kruassan', 'choy', 'sharbat'] },
    { login: 'seller_oila', name: 'Oila Supermarket', address: "Toshkent sh., Lutfiy ko'chasi, 6", lat: 41.2720, lng: 69.2290, open: '08:00', close: '23:00', logo: IMG.cucumber,
      items: ['nonSamarqand', 'sut', 'tvorog', 'pishloq', 'cola', 'suv', 'sharbat', 'olma', 'banan', 'kartoshka', 'piyoz', 'pechenye'] },
    { login: 'seller_yunusobod', name: 'Yunusobod Savdo', address: 'Toshkent sh., Yunusobod 4-mavze, 12', lat: 41.3640, lng: 69.2870, open: '08:00', close: '23:00', logo: IMG.shop,
      items: ['nonOq', 'sut', 'cola', 'olma', 'chips', 'choy'] },
    { login: 'seller_buyukipak', name: "Buyuk Ipak Yo'li Market", address: "Toshkent sh., Mirzo Ulug'bek tumani, Buyuk Ipak Yo'li, 45", lat: 41.3260, lng: 69.3350, open: '07:00', close: '23:00', logo: IMG.water,
      items: ['nonSamarqand', 'qatiq', 'suv', 'pomidor', 'bodring', 'holva'] },
    { login: 'seller_sergeli', name: 'Sergeli Oziq-Ovqat', address: 'Toshkent sh., Sergeli 6-mavze, 30', lat: 41.2270, lng: 69.2220, open: '08:00', close: '22:00', logo: IMG.loaf,
      items: ['nonOq', 'patir', 'sut', 'smetana', 'kartoshka', 'piyoz', 'cola'] },
  ];

  let extraProducts = 0;
  for (const [i, s] of extraShops.entries()) {
    const owner = await prisma.user.upsert({
      where: { login: s.login },
      update: {},
      create: {
        login: s.login,
        phone: `+99890100${String(i + 1).padStart(4, '0')}`,
        name: `${s.name} egasi`,
        password_hash: sellerPasswordHash,
        role: UserRole.seller,
        language: 'uz',
        is_blocked: false,
        must_change_password: true,
      },
    });

    await prisma.shop.deleteMany({ where: { owner_id: owner.id } });
    const extraShop = await prisma.shop.create({
      data: {
        owner_id: owner.id,
        city_id: tashkent.id,
        name: s.name,
        logo_url: s.logo,
        phone: owner.phone!,
        address_text: s.address,
        lat: s.lat,
        lng: s.lng,
        open_time: s.open,
        close_time: s.close,
        is_open: true,
        is_active: true,
        commission_rate_percent: 0,
      },
    });

    for (const key of s.items) {
      const [catIdx, uz, ru, en, priceUzs, image] = catalog[key];
      // Small per-shop price variation so shops don't look identical
      const price = Math.round((priceUzs * (0.9 + ((i * 7 + key.length) % 5) * 0.05)) / 500) * 500;
      await prisma.product.create({
        data: {
          shop_id: extraShop.id,
          category_id: categories[catIdx].id,
          name_uz: uz,
          name_ru: ru,
          name_en: en,
          price: price * 100, // tiyin
          stock: 20 + ((i + key.length) % 6) * 10,
          is_available: true,
          image_url: image,
        },
      });
      extraProducts++;
    }
  }
  console.log(`Extra shops seeded: ${extraShops.length} (products: ${extraProducts})`);

  // 10. Seed Promo Codes (managed from the admin panel afterwards)
  const promoCodes = [
    { code: 'YANGI10', description: 'Yangi mijozlar uchun 10% chegirma', discount_percent: 10 },
    { code: 'LOCALSHOP', description: 'Umumiy 10% chegirma', discount_percent: 10 },
    { code: 'TEZ10', description: 'Tezkor yetkazish aksiyasi', discount_percent: 10 },
  ];
  for (const promo of promoCodes) {
    await prisma.promoCode.upsert({ where: { code: promo.code }, update: {}, create: promo });
  }
  console.log(`Promo codes seeded: ${promoCodes.length}`);

  console.log('--- Database Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
