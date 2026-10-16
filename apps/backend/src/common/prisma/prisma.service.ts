import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isPostgresConnected = false;
  private memoryStore: Record<string, any[]> = {};

  async onModuleInit() {
    try {
      await this.$connect();
      this.isPostgresConnected = true;
      this.logger.log('Connected to PostgreSQL Database.');
    } catch (err: any) {
      this.isPostgresConnected = false;
      this.logger.warn(`PostgreSQL not detected on localhost:5432 (${err.message}). Activating in-memory store for local development.`);
      await this.initInMemoryStore();
      this.wrapModelsWithMemoryFallback();
    }
  }

  async onModuleDestroy() {
    if (this.isPostgresConnected) {
      await this.$disconnect();
    }
  }

  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  private async initInMemoryStore() {
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    const sellerPasswordHash = await bcrypt.hash('Shopkeeper123!', 10);

    const tashkent = {
      id: '00000000-0000-0000-0000-000000000001',
      name_uz: 'Toshkent',
      name_ru: 'Ташкент',
      name_en: 'Tashkent',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const admin = {
      id: 'u-admin-1',
      login: 'admin',
      name: 'Platform Administrator',
      password_hash: adminPasswordHash,
      role: 'admin',
      language: 'uz',
      is_blocked: false,
      must_change_password: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const seller = {
      id: 'u-seller-1',
      login: 'seller_chilonzor',
      phone: '+998909876543',
      name: 'Bobur Shopkeeper',
      password_hash: sellerPasswordHash,
      role: 'seller',
      language: 'uz',
      is_blocked: false,
      must_change_password: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const customer = {
      id: 'u-customer-1',
      phone: '+998901234567',
      name: 'Sardor Aliyev',
      role: 'customer',
      language: 'uz',
      is_blocked: false,
      must_change_password: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const shop = {
      id: 's-chilonzor-1',
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
      status: 'active',
      commission_rate_percent: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const address = {
      id: 'a-customer-1',
      user_id: customer.id,
      city_id: tashkent.id,
      title: 'Uy',
      address_text: 'Toshkent sh., Chilonzor 5-mavze, 12-uy',
      lat: 41.2840,
      lng: 69.2160,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const categories = [
      { id: 'c-1', name_uz: 'Non va pishiriqlar', name_ru: 'Хлеб и выпечка', name_en: 'Bakery & Bread', icon_url: 'bread-slice' },
      { id: 'c-2', name_uz: 'Sut va sut mahsulotlari', name_ru: 'Молочные продукты', name_en: 'Dairy Products', icon_url: 'glass-whiskey' },
      { id: 'c-3', name_uz: 'Ichimliklar va sharbatlar', name_ru: 'Напитки и соки', name_en: 'Beverages & Juices', icon_url: 'wine-bottle' },
      { id: 'c-4', name_uz: 'Meva va sabzavotlar', name_ru: 'Овощи и фрукты', name_en: 'Fruits & Vegetables', icon_url: 'apple-alt' },
      { id: 'c-5', name_uz: 'Shirinliklar va gazaklar', name_ru: 'Сладости и снеки', name_en: 'Sweets & Snacks', icon_url: 'cookie' },
    ];

    const products = [
      {
        id: 'p-1',
        shop_id: shop.id,
        category_id: 'c-1',
        name_uz: 'Samarqand noni',
        name_ru: 'Самаркандская лепешка',
        name_en: 'Samarkand Flatbread',
        description_uz: 'Issiq va xushbo\'y an\'anaviy Samarqand tandir noni.',
        price: 800000,
        stock: 45,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
      {
        id: 'p-2',
        shop_id: shop.id,
        category_id: 'c-1',
        name_uz: 'Buxanka oq non',
        name_ru: 'Формовой белый хлеб',
        name_en: 'White Loaf Bread',
        price: 400000,
        stock: 30,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
      {
        id: 'p-3',
        shop_id: shop.id,
        category_id: 'c-2',
        name_uz: 'Musaffo sut 3.2% 1L',
        name_ru: 'Молоко Musaffo 3.2% 1л',
        name_en: 'Musaffo Milk 3.2% 1L',
        price: 1300000,
        stock: 25,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
      {
        id: 'p-4',
        shop_id: shop.id,
        category_id: 'c-3',
        name_uz: 'Coca-Cola Classic 1.5L',
        name_ru: 'Coca-Cola Классическая 1.5л',
        name_en: 'Coca-Cola Classic 1.5L',
        price: 1400000,
        stock: 50,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
      {
        id: 'p-5',
        shop_id: shop.id,
        category_id: 'c-4',
        name_uz: 'Qizil olma (1 kg)',
        name_ru: 'Яблоки красные (1 кг)',
        name_en: 'Red Apples (1 kg)',
        price: 1600000,
        stock: 40,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ];

    const demoOrder = {
      id: 'o-demo-1',
      customer_id: customer.id,
      shop_id: shop.id,
      address_snapshot: { lat: 41.2840, lng: 69.2160, text: address.address_text },
      customer_phone: customer.phone,
      status: 'new',
      payment_method: 'cash',
      payment_status: 'pending',
      total_amount: 2100000,
      commission_rate_percent: 0,
      commission_amount: 0,
      comment: 'Eshik qo\'ng\'irog\'ini chaling',
      needs_attention: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const demoOrderItems = [
      { id: 'oi-1', order_id: demoOrder.id, product_id: 'p-1', product_name: 'Samarqand noni', unit_price: 800000, quantity: 1 },
      { id: 'oi-2', order_id: demoOrder.id, product_id: 'p-3', product_name: 'Musaffo sut 3.2% 1L', unit_price: 1300000, quantity: 1 },
    ];

    this.memoryStore = {
      cities: [tashkent],
      users: [admin, seller, customer],
      shops: [shop],
      addresses: [address],
      categories,
      products,
      orders: [demoOrder],
      orderItems: demoOrderItems,
      orderStatusHistories: [
        { id: 'osh-1', order_id: demoOrder.id, status: 'new', changed_by: customer.id, reason: 'Buyurtma rasmiylashtirildi', created_at: new Date() },
      ],
      carts: [],
      cartItems: [],
      smsCodes: [],
      payments: [],
      notifications: [],
      refreshTokens: [],
      deviceTokens: [],
    };
  }

  private wrapModelsWithMemoryFallback() {
    const models = [
      { key: 'user', storeKey: 'users' },
      { key: 'shop', storeKey: 'shops' },
      { key: 'city', storeKey: 'cities' },
      { key: 'category', storeKey: 'categories' },
      { key: 'product', storeKey: 'products' },
      { key: 'address', storeKey: 'addresses' },
      { key: 'order', storeKey: 'orders' },
      { key: 'orderItem', storeKey: 'orderItems' },
      { key: 'orderStatusHistory', storeKey: 'orderStatusHistories' },
      { key: 'cart', storeKey: 'carts' },
      { key: 'cartItem', storeKey: 'cartItems' },
      { key: 'smsCode', storeKey: 'smsCodes' },
      { key: 'payment', storeKey: 'payments' },
      { key: 'notification', storeKey: 'notifications' },
      { key: 'refreshToken', storeKey: 'refreshTokens' },
      { key: 'deviceToken', storeKey: 'deviceTokens' },
    ];

    for (const { key, storeKey } of models) {
      (this as any)[key] = this.createModelMemoryHandler(storeKey);
    }

    // Override $transaction
    (this as any).$transaction = async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(this);
      }
      return Promise.all(cb);
    };

    // Override $queryRaw
    (this as any).$queryRaw = async () => {
      return this.memoryStore.shops;
    };
  }

  private createModelMemoryHandler(storeKey: string) {
    const getStore = () => this.memoryStore[storeKey] || [];
    const setStore = (data: any[]) => {
      this.memoryStore[storeKey] = data;
    };

    return {
      findUnique: async ({ where, include }: any) => {
        const item = getStore().find((i) => this.matchesWhere(i, where));
        return item ? this.enrichItem(item, storeKey, include) : null;
      },
      findFirst: async ({ where, include, orderBy }: any) => {
        let items = getStore().filter((i) => this.matchesWhere(i, where));
        if (orderBy) {
          items = this.sortItems(items, orderBy);
        }
        return items.length > 0 ? this.enrichItem(items[0], storeKey, include) : null;
      },
      findMany: async ({ where, include, orderBy, skip, take }: any = {}) => {
        let items = getStore();
        if (where) {
          items = items.filter((i) => this.matchesWhere(i, where));
        }
        if (orderBy) {
          items = this.sortItems(items, orderBy);
        }
        if (skip !== undefined) {
          items = items.slice(skip);
        }
        if (take !== undefined) {
          items = items.slice(0, take);
        }
        return items.map((i) => this.enrichItem(i, storeKey, include));
      },
      create: async ({ data, include }: any) => {
        const newItem = {
          id: data.id || uuidv4(),
          created_at: new Date(),
          updated_at: new Date(),
          ...data,
        };
        // Handle nested creates if any
        if (data.items?.create) {
          for (const itm of data.items.create) {
            this.memoryStore.orderItems.push({
              id: uuidv4(),
              order_id: newItem.id,
              created_at: new Date(),
              ...itm,
            });
          }
          delete newItem.items;
        }
        if (data.status_history?.create) {
          this.memoryStore.orderStatusHistories.push({
            id: uuidv4(),
            order_id: newItem.id,
            created_at: new Date(),
            ...data.status_history.create,
          });
          delete newItem.status_history;
        }

        getStore().push(newItem);
        return this.enrichItem(newItem, storeKey, include);
      },
      createMany: async ({ data }: any) => {
        const records = data.map((d: any) => ({
          id: d.id || uuidv4(),
          created_at: new Date(),
          updated_at: new Date(),
          ...d,
        }));
        getStore().push(...records);
        return { count: records.length };
      },
      update: async ({ where, data, include }: any) => {
        const index = getStore().findIndex((i) => this.matchesWhere(i, where));
        if (index === -1) throw new Error('Record not found');

        const current = getStore()[index];
        const updated = { ...current, ...data, updated_at: new Date() };

        if (data.stock?.increment !== undefined) {
          updated.stock = (current.stock || 0) + data.stock.increment;
        }
        if (data.attempts?.increment !== undefined) {
          updated.attempts = (current.attempts || 0) + data.attempts.increment;
        }

        getStore()[index] = updated;
        return this.enrichItem(updated, storeKey, include);
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        const items = getStore();
        for (let i = 0; i < items.length; i++) {
          if (this.matchesWhere(items[i], where)) {
            items[i] = { ...items[i], ...data, updated_at: new Date() };
            count++;
          }
        }
        return { count };
      },
      delete: async ({ where }: any) => {
        const index = getStore().findIndex((i) => this.matchesWhere(i, where));
        if (index === -1) return null;
        const [deleted] = getStore().splice(index, 1);
        return deleted;
      },
      deleteMany: async ({ where }: any = {}) => {
        if (!where || Object.keys(where).length === 0) {
          const count = getStore().length;
          setStore([]);
          return { count };
        }
        const initial = getStore().length;
        const filtered = getStore().filter((i) => !this.matchesWhere(i, where));
        setStore(filtered);
        return { count: initial - filtered.length };
      },
      count: async ({ where }: any = {}) => {
        if (!where) return getStore().length;
        return getStore().filter((i) => this.matchesWhere(i, where)).length;
      },
      upsert: async ({ where, update, create }: any) => {
        const existing = getStore().find((i) => this.matchesWhere(i, where));
        if (existing) {
          return this.enrichItem({ ...existing, ...update }, storeKey);
        }
        const newItem = { id: uuidv4(), created_at: new Date(), updated_at: new Date(), ...create };
        getStore().push(newItem);
        return this.enrichItem(newItem, storeKey);
      },
    };
  }

  private matchesWhere(item: any, where: any): boolean {
    if (!where) return true;
    for (const key of Object.keys(where)) {
      const val = where[key];
      if (val === undefined) continue;

      if (key === 'OR' && Array.isArray(val)) {
        const matchAny = val.some((cond) => this.matchesWhere(item, cond));
        if (!matchAny) return false;
        continue;
      }

      if (val && typeof val === 'object') {
        if (val.in && Array.isArray(val.in)) {
          if (!val.in.includes(item[key])) return false;
        } else if (val.not !== undefined) {
          if (item[key] === val.not) return false;
        } else if (val.gte !== undefined) {
          if (new Date(item[key]) < new Date(val.gte)) return false;
        } else if (val.lte !== undefined) {
          if (new Date(item[key]) > new Date(val.lte)) return false;
        } else if (val.contains !== undefined) {
          const itemVal = (item[key] || '').toLowerCase();
          const target = val.contains.toLowerCase();
          if (!itemVal.includes(target)) return false;
        }
      } else {
        if (item[key] !== val) return false;
      }
    }
    return true;
  }

  private sortItems(items: any[], orderBy: any) {
    if (Array.isArray(orderBy)) {
      orderBy = orderBy[0];
    }
    const key = Object.keys(orderBy)[0];
    const direction = orderBy[key] === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      if (a[key] < b[key]) return -1 * direction;
      if (a[key] > b[key]) return 1 * direction;
      return 0;
    });
  }

  private enrichItem(item: any, storeKey: string, include?: any): any {
    if (!include) return { ...item };
    const clone = { ...item };

    if (storeKey === 'users') {
      if (include.shops) {
        clone.shops = this.memoryStore.shops.filter((s) => s.owner_id === item.id);
      }
      if (include.addresses) {
        clone.addresses = this.memoryStore.addresses.filter((a) => a.user_id === item.id);
      }
    } else if (storeKey === 'shops') {
      if (include.owner) {
        clone.owner = this.memoryStore.users.find((u) => u.id === item.owner_id);
      }
      if (include.city) {
        clone.city = this.memoryStore.cities.find((c) => c.id === item.city_id);
      }
      if (include._count) {
        clone._count = {
          products: this.memoryStore.products.filter((p) => p.shop_id === item.id && !p.deleted_at).length,
          orders: this.memoryStore.orders.filter((o) => o.shop_id === item.id).length,
        };
      }
    } else if (storeKey === 'products') {
      if (include.category) {
        clone.category = this.memoryStore.categories.find((c) => c.id === item.category_id);
      }
    } else if (storeKey === 'carts') {
      if (include.shop) {
        clone.shop = this.memoryStore.shops.find((s) => s.id === item.shop_id);
      }
      if (include.items) {
        clone.items = this.memoryStore.cartItems
          .filter((ci) => ci.cart_id === item.id)
          .map((ci) => ({
            ...ci,
            product: this.memoryStore.products.find((p) => p.id === ci.product_id),
          }));
      }
    } else if (storeKey === 'orders') {
      if (include.items) {
        clone.items = this.memoryStore.orderItems.filter((oi) => oi.order_id === item.id);
      }
      if (include.shop) {
        clone.shop = this.memoryStore.shops.find((s) => s.id === item.shop_id);
      }
      if (include.customer) {
        clone.customer = this.memoryStore.users.find((u) => u.id === item.customer_id);
      }
      if (include.status_history) {
        clone.status_history = this.memoryStore.orderStatusHistories.filter((osh) => osh.order_id === item.id);
      }
    }

    return clone;
  }
}
