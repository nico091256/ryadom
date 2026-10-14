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
