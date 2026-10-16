// tools/mock-server.js
// Lightweight local development API server on port 4000
// Runs without Docker / PostgreSQL / Redis so the Flutter client can be tested immediately.

const http = require('http');
const url = require('url');

const PORT = 4000;

const mockUser = {
  id: 'usr_tashkent_test_01',
  phone: '+998901234567',
  role: 'CUSTOMER',
  name: 'Elshodbek Turayev',
  language: 'uz',
  created_at: new Date().toISOString(),
};

const mockShops = [
  {
    id: 'shp_chilonzor_01',
    name: 'Chilonzor Oziq-ovqat',
    description: 'Mahalliy yangi mahsulotlar va kundalik tovarlar',
    address_text: 'Chilonzor 9-mavze, 12-uy',
    lat: 41.2858,
    lng: 69.2035,
    distance_meters: 350,
    rating: 4.8,
    is_open: true,
    phone: '+998712001122',
    image_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400',
    delivery_fee: 0,
    min_order_amount: 25000,
    estimated_delivery_minutes: 25,
  },
  {
    id: 'shp_yunusobod_02',
    name: 'Makon Supermarket',
    description: 'Barcha turdagi oziq-ovqat va ichimliklar',
    address_text: 'Yunusobod 4-mavze, 45-uy',
    lat: 41.3644,
    lng: 69.2872,
    distance_meters: 850,
    rating: 4.9,
    is_open: true,
    phone: '+998712003344',
    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
    delivery_fee: 0,
    min_order_amount: 30000,
    estimated_delivery_minutes: 20,
  },
  {
    id: 'shp_mirzo_03',
    name: 'Baraka Non va Qandolat',
    description: 'Yangi yopilgan issiq nonlar, pishiriqlar va shirinliklar',
    address_text: 'Buyuk Ipak Yo\'li ko\'chasi, 88',
    lat: 41.3265,
    lng: 69.3288,
    distance_meters: 1200,
    rating: 4.7,
    is_open: true,
    phone: '+998712005566',
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
    delivery_fee: 0,
    min_order_amount: 20000,
    estimated_delivery_minutes: 15,
  },
];

const mockProducts = [
  {
    id: 'prd_01',
    shop_id: 'shp_chilonzor_01',
    name: 'Tandir Non (Issiq)',
    description: 'Yangi yopilgan an\'anaviy o\'zbek noni',
    price: 4000,
    unit: 'dona',
    is_available: true,
    category_id: 'cat_bakery',
    image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400',
  },
  {
    id: 'prd_02',
    shop_id: 'shp_chilonzor_01',
    name: 'Sut 3.2% (Musaffo 1L)',
    description: 'Tabiiy pasterizatsiyalangan sut',
    price: 13500,
    unit: 'dona',
    is_available: true,
    category_id: 'cat_dairy',
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
  },
  {
    id: 'prd_03',
    shop_id: 'shp_chilonzor_01',
    name: 'Tuxum S1 (10 dona)',
    description: 'Yangi tovuq tuxumlari',
    price: 18000,
    unit: 'qadoq',
    is_available: true,
    category_id: 'cat_dairy',
    image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',
  },
  {
    id: 'prd_04',
    shop_id: 'shp_chilonzor_01',
    name: 'Coca-Cola Classic (1.5L)',
    description: 'Salqinlashtiruvchi gazli ichimlik',
    price: 14500,
    unit: 'dona',
    is_available: true,
    category_id: 'cat_drinks',
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
  },
  {
    id: 'prd_05',
    shop_id: 'shp_chilonzor_01',
    name: 'Banan (Ekvador)',
    description: 'Yangi shirin sariq bananlar',
    price: 26000,
    unit: 'kg',
    is_available: true,
    category_id: 'cat_fruits',
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
  },
];

const mockOrders = [];

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
        // ignore parse error for form-data
      }
    }

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // Auth endpoints
    if (pathname === '/api/v1/auth/send-code' && req.method === 'POST') {
      return sendJson(200, {
        success: true,
        message: 'Tasdiqlash kodi yuborildi (Dev kod: 123456)',
      });
    }

    if (pathname === '/api/v1/auth/verify' && req.method === 'POST') {
      const { phone, code } = parsedBody;
      return sendJson(200, {
        accessToken: 'mock_jwt_access_token_customer_123',
        refreshToken: 'mock_jwt_refresh_token_customer_123',
        isNewUser: false,
        user: {
          ...mockUser,
          phone: phone || mockUser.phone,
        },
      });
    }

    if (pathname === '/api/v1/auth/logout' && req.method === 'POST') {
      return sendJson(200, { success: true });
    }

    if (pathname === '/api/v1/me') {
      if (req.method === 'GET') {
        return sendJson(200, mockUser);
      }
      if (req.method === 'PATCH') {
        Object.assign(mockUser, parsedBody);
        return sendJson(200, mockUser);
      }
    }

    // Shops endpoints
    if (pathname === '/api/v1/shops/nearby' && req.method === 'GET') {
      return sendJson(200, mockShops);
    }

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
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
      }
      return sendJson(200, filtered);
    }

    if (pathname.startsWith('/api/v1/shops/') && req.method === 'GET') {
      const shopId = pathname.replace('/api/v1/shops/', '');
      const shop = mockShops.find(s => s.id === shopId) || mockShops[0];
      return sendJson(200, shop);
    }

    // Orders endpoints
    if (pathname === '/api/v1/orders' && req.method === 'GET') {
      return sendJson(200, {
        data: mockOrders,
        total: mockOrders.length,
        page: 1,
        limit: 100,
      });
    }

    if (pathname === '/api/v1/orders' && req.method === 'POST') {
      const newOrder = {
        id: 'ord_' + Date.now(),
        order_number: 'RD-' + Math.floor(1000 + Math.random() * 9000),
        status: 'PENDING',
        total_amount: 45000,
        delivery_fee: 0,
        address_text: parsedBody.address_text || 'Chilonzor 9-mavze',
        lat: parsedBody.lat || 41.2858,
        lng: parsedBody.lng || 69.2035,
        payment_method: parsedBody.payment_method || 'CASH',
        customer_phone: parsedBody.customer_phone || mockUser.phone,
        created_at: new Date().toISOString(),
        items: [
          {
            id: 'item_1',
            product_name: 'Tandir Non (Issiq)',
            quantity: 2,
            unit_price: 4000,
            total_price: 8000,
          },
        ],
      };
      mockOrders.unshift(newOrder);
      return sendJson(201, newOrder);
    }

    if (pathname.startsWith('/api/v1/orders/') && req.method === 'GET') {
      const orderId = pathname.replace('/api/v1/orders/', '');
      const order = mockOrders.find(o => o.id === orderId) || mockOrders[0];
      return sendJson(200, order || {});
    }

    // Default 404
    sendJson(404, { error: 'Not Found', path: pathname });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 Ryadom Dev API Server ishga tushdi!`);
  console.log(`   Manzil: http://localhost:${PORT}/api/v1`);
  console.log(`   Flutter ilovasi (mobile_client) to'g'ridan-to'g'ri ulanishi mumkin.`);
  console.log(`   Test telefon: +998901234567`);
  console.log(`   Tasdiqlash kodi: 123456`);
  console.log(`=================================================`);
});
