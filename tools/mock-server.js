// tools/mock-server.js
// Lightweight local development API server on port 4000
// Runs without Docker / PostgreSQL / Redis so the Flutter client can be tested immediately.
// Strictly adheres to packages/shared and apps/mobile_client domain models.

const http = require('http');
const url = require('url');

const PORT = 4000;

const mockUser = {
  id: 'usr_tashkent_test_01',
  phone: '+998901234567',
  role: 'customer', // strictly lowercase per UserRole enum
  name: 'Elshodbek Turayev',
  language: 'uz', // strictly lowercase per SupportedLanguage enum
  created_at: new Date().toISOString(),
};

const mockCategories = [
  { id: 'cat_bakery', name_uz: 'Non va pishiriqlar', name_ru: 'Хлеб и выпечка', name_en: 'Bakery' },
  { id: 'cat_dairy', name_uz: 'Sut va tuxum', name_ru: 'Молоко и яйца', name_en: 'Dairy & Eggs' },
  { id: 'cat_drinks', name_uz: 'Ichimliklar', name_ru: 'Напитки', name_en: 'Drinks' },
  { id: 'cat_fruits', name_uz: 'Meva va sabzavotlar', name_ru: 'Фрукты и овощи', name_en: 'Fruits & Veggies' },
];

const mockShops = [
  {
    id: 'shp_chilonzor_01',
    name: 'Chilonzor Oziq-ovqat',
    logo_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400',
    phone: '+998712001122',
    address_text: 'Chilonzor 9-mavze, 12-uy',
    lat: 41.2858,
    lng: 69.2035,
    open_time: '08:00',
    close_time: '23:00',
    is_open: true,
    isCurrentlyOpen: true,
    distanceMeters: 350,
    productCount: 15,
  },
  {
    id: 'shp_yunusobod_02',
    name: 'Makon Supermarket',
    logo_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
    phone: '+998712003344',
    address_text: 'Yunusobod 4-mavze, 45-uy',
    lat: 41.3644,
    lng: 69.2872,
    open_time: '08:00',
    close_time: '23:00',
    is_open: true,
    isCurrentlyOpen: true,
    distanceMeters: 850,
    productCount: 24,
  },
  {
    id: 'shp_mirzo_03',
    name: 'Baraka Non va Qandolat',
    logo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
    phone: '+998712005566',
    address_text: "Buyuk Ipak Yo'li ko'chasi, 88",
    lat: 41.3265,
    lng: 69.3288,
    open_time: '07:00',
    close_time: '22:00',
    is_open: true,
    isCurrentlyOpen: true,
    distanceMeters: 1200,
    productCount: 8,
  },
];

const mockProducts = [
  {
    id: 'prd_01',
    shop_id: 'shp_chilonzor_01',
    category_id: 'cat_bakery',
    name_uz: 'Tandir Non (Issiq)',
    name_ru: 'Тандырная лепешка (Горячая)',
    name_en: 'Tandoor Bread (Hot)',
    description_uz: "Yangi yopilgan an'anaviy issiq o'zbek noni",
    price: 400000, // 4 000 UZS in tiyin
    stock: 50,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400',
    category: mockCategories[0],
  },
  {
    id: 'prd_02',
    shop_id: 'shp_chilonzor_01',
    category_id: 'cat_dairy',
    name_uz: 'Sut 3.2% (Musaffo 1L)',
    name_ru: 'Молоко 3.2% (Musaffo 1L)',
    name_en: 'Milk 3.2% (Musaffo 1L)',
    description_uz: 'Tabiiy pasterizatsiyalangan sut',
    price: 1350000, // 13 500 UZS in tiyin
    stock: 25,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
    category: mockCategories[1],
  },
  {
    id: 'prd_03',
    shop_id: 'shp_chilonzor_01',
    category_id: 'cat_dairy',
    name_uz: 'Tuxum S1 (10 dona)',
    name_ru: 'Яйца С1 (10 шт)',
    name_en: 'Eggs Grade A (10 pcs)',
    description_uz: 'Yangi tovuq tuxumlari',
    price: 1800000, // 18 000 UZS in tiyin
    stock: 40,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',
    category: mockCategories[1],
  },
  {
    id: 'prd_04',
    shop_id: 'shp_chilonzor_01',
    category_id: 'cat_drinks',
    name_uz: 'Coca-Cola Classic (1.5L)',
    name_ru: 'Кока-Кола (1.5л)',
    name_en: 'Coca-Cola Classic (1.5L)',
    description_uz: 'Salqinlashtiruvchi gazli ichimlik',
    price: 1450000, // 14 500 UZS in tiyin
    stock: 60,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
    category: mockCategories[2],
  },
  {
    id: 'prd_05',
    shop_id: 'shp_chilonzor_01',
    category_id: 'cat_fruits',
    name_uz: 'Banan (Ekvador)',
    name_ru: 'Бананы (Эквадор)',
    name_en: 'Bananas (Ecuador)',
    description_uz: 'Yangi shirin sariq bananlar',
    price: 2600000, // 26 000 UZS in tiyin
    stock: 30,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
    category: mockCategories[3],
  },
];

const mockOrders = [
  {
    id: 'ord_demo_sample_01',
    status: 'delivered', // lowercase per OrderStatus enum
    payment_method: 'cash', // lowercase per PaymentMethod enum
    total_amount: 4500000, // 45 000 UZS in tiyin
    address_snapshot: {
      text: 'Chilonzor 9-mavze, 12-uy',
    },
    customer_phone: '+998901234567',
    comment: 'Iltimos, eshik qo\'ng\'irog\'ini chaling',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    shop: {
      name: 'Chilonzor Oziq-ovqat',
      phone: '+998712001122',
    },
    items: [
      {
        product_name: 'Tandir Non (Issiq)',
        unit_price: 400000,
        quantity: 2,
      },
      {
        product_name: 'Sut 3.2% (Musaffo 1L)',
        unit_price: 1350000,
        quantity: 1,
      },
    ],
    status_history: [
      {
        status: 'new',
        reason: null,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        status: 'accepted',
        reason: null,
        created_at: new Date(Date.now() - 3600000 * 2 + 180000).toISOString(),
      },
      {
        status: 'on_the_way',
        reason: null,
        created_at: new Date(Date.now() - 3600000 * 2 + 600000).toISOString(),
      },
      {
        status: 'delivered',
        reason: null,
        created_at: new Date(Date.now() - 3600000 * 2 + 1200000).toISOString(),
      },
    ],
  },
];

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        // ignore parse error
      }
    }

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // Auth: send-code
    if (pathname === '/api/v1/auth/send-code' && req.method === 'POST') {
      return sendJson(200, {
        success: true,
        message: 'Tasdiqlash kodi yuborildi (Dev kod: 123456)',
      });
    }

    // Auth: verify
    if (pathname === '/api/v1/auth/verify' && req.method === 'POST') {
      const { phone } = parsedBody;
      const user = {
        ...mockUser,
        phone: phone || mockUser.phone,
      };
      return sendJson(200, {
        accessToken: 'mock_jwt_access_token_customer_123',
        refreshToken: 'mock_jwt_refresh_token_customer_123',
        isNewUser: false,
        user: user,
      });
    }

    // Auth: logout
    if (pathname === '/api/v1/auth/logout' && req.method === 'POST') {
      return sendJson(200, { success: true });
    }

    // Me (Profile)
    if (pathname === '/api/v1/me') {
      if (req.method === 'GET') {
        return sendJson(200, mockUser);
      }
      if (req.method === 'PATCH') {
        Object.assign(mockUser, parsedBody);
        return sendJson(200, mockUser);
      }
    }

    // Shops: nearby
    if (pathname === '/api/v1/shops/nearby' && req.method === 'GET') {
      return sendJson(200, mockShops);
    }

    // Shop: products
    if (pathname.startsWith('/api/v1/shops/') && pathname.endsWith('/products') && req.method === 'GET') {
      const parts = pathname.split('/');
      const shopId = parts[4];
      const category = parsedUrl.query.category;
      const q = (parsedUrl.query.q || '').toLowerCase();

      let filtered = mockProducts;
      if (category) {
        filtered = filtered.filter(p => p.category_id === category);
      }
      if (q) {
        filtered = filtered.filter(p =>
          (p.name_uz || '').toLowerCase().includes(q) ||
          (p.name_ru || '').toLowerCase().includes(q)
        );
      }
      return sendJson(200, filtered);
    }

    // Shop: single
    if (pathname.startsWith('/api/v1/shops/') && req.method === 'GET') {
      const shopId = pathname.replace('/api/v1/shops/', '');
      const shop = mockShops.find(s => s.id === shopId) || mockShops[0];
      return sendJson(200, shop);
    }

    // Orders: myOrders
    if (pathname === '/api/v1/orders' && req.method === 'GET') {
      return sendJson(200, {
        data: mockOrders,
        total: mockOrders.length,
        page: 1,
        limit: 100,
      });
    }

    // Orders: createOrder
    if (pathname === '/api/v1/orders' && req.method === 'POST') {
      const newOrder = {
        id: 'ord_' + Date.now(),
        status: 'new', // lowercase OrderStatus.newOrder
        payment_method: (parsedBody.payment_method || 'cash').toLowerCase(),
        total_amount: 4500000,
        address_snapshot: {
          text: parsedBody.address_text || 'Chilonzor 9-mavze, 12-uy',
        },
        customer_phone: parsedBody.customer_phone || mockUser.phone,
        comment: parsedBody.comment || null,
        created_at: new Date().toISOString(),
        shop: {
          name: 'Chilonzor Oziq-ovqat',
          phone: '+998712001122',
        },
        items: [
          {
            product_name: 'Tandir Non (Issiq)',
            unit_price: 400000,
            quantity: 2,
          },
        ],
        status_history: [
          {
            status: 'new',
            reason: null,
            created_at: new Date().toISOString(),
          },
        ],
      };
      mockOrders.unshift(newOrder);
      return sendJson(201, newOrder);
    }

    // Orders: single order
    if (pathname.startsWith('/api/v1/orders/') && !pathname.endsWith('/review') && req.method === 'GET') {
      const orderId = pathname.replace('/api/v1/orders/', '');
      const order = mockOrders.find(o => o.id === orderId) || mockOrders[0];
      return sendJson(200, order || {});
    }

    // Orders: review (PDF Page 17 spec: POST /orders/{id}/review)
    if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/review') && req.method === 'POST') {
      const orderId = pathname.replace('/api/v1/orders/', '').replace('/review', '');
      const order = mockOrders.find(o => o.id === orderId);
      if (order) {
        order.review = {
          stars: parsedBody.stars || 5,
          comment: parsedBody.comment || '',
          created_at: new Date().toISOString(),
        };
      }
      return sendJson(201, {
        success: true,
        message: 'Review saved successfully',
        orderId,
        review: parsedBody,
      });
    }

    // Uploads
    if (pathname === '/api/v1/uploads/image' && req.method === 'POST') {
      return sendJson(200, { url: '/uploads/sample.webp' });
    }

    // Default 404
    sendJson(404, { error: 'Not Found', path: pathname });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 Ryadom Dev API Server ishga tushdi!`);
  console.log(`   Manzil: http://localhost:${PORT}/api/v1`);
  console.log(`   Model sinxronizatsiyasi: 100% moslashtirildi.`);
  console.log(`   Test telefon: +998901234567`);
  console.log(`   Tasdiqlash kodi: 123456`);
  console.log(`=================================================`);
});
