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
      // The seeded in-memory store (well-known demo passwords, data lost on restart) is a
      // local-development convenience only. Anything that is not plainly dev/test must
      // fail fast so the orchestrator restarts the process until the database is back.
      if (!PrismaService.inMemoryFallbackAllowed()) {
        this.logger.error(`PostgreSQL connection failed (${err.message}). Refusing to start without a database.`);
        throw err;
      }
      this.logger.warn(`PostgreSQL not reachable (${err.message}). Activating the in-memory store for local development.`);
      await this.initInMemoryStore();
      this.wrapModelsWithMemoryFallback();
    }
  }

  /** Only `development`, `test` or an unset NODE_ENV may fall back to the in-memory store. */
  static inMemoryFallbackAllowed(env: string | undefined = process.env.NODE_ENV): boolean {
    return env === undefined || env === '' || env === 'development' || env === 'test';
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
      orderReviews: [],
      auditLogs: [],
      promoCodes: [
        {
          id: 'promo-1',
          code: 'YANGI10',
          description: 'Yangi mijozlar uchun 10% chegirma',
          discount_percent: 10,
          max_discount_tiyin: 2000000,
          min_order_tiyin: 1000000,
          usage_limit: null,
          usage_count: 0,
          is_active: true,
          expires_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
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
      { key: 'promoCode', storeKey: 'promoCodes' },
      { key: 'orderReview', storeKey: 'orderReviews' },
      { key: 'auditLog', storeKey: 'auditLogs' },
    ];

    for (const { key, storeKey } of models) {
      (this as any)[key] = this.createModelMemoryHandler(storeKey);
    }

    // Override $transaction. The callback form gets rollback semantics: the whole
    // store is snapshotted first and restored if the callback throws, so a failed
    // multi-step write (e.g. second order item out of stock) leaves no partial state.
    // The array form stays Promise.all (it is only used for independent reads).
    (this as any).$transaction = async (cb: any) => {
      if (typeof cb === 'function') {
        const snapshot = PrismaService.cloneStore(this.memoryStore);
        try {
          return await cb(this);
        } catch (err) {
          this.memoryStore = snapshot;
          throw err;
        }
      }
      return Promise.all(cb);
    };

    // Raw SQL (PostGIS nearby search) is not available in memory mode; callers
    // catch this and fall back to the Haversine implementation.
    (this as any).$queryRaw = async () => {
      throw new Error('Raw SQL is not supported by the in-memory store');
    };
    (this as any).$executeRaw = (this as any).$queryRaw;
  }

  /** Deep clone of the memory store that keeps Date instances intact (JSON would stringify them). */
  private static cloneStore<T>(value: T): T {
    if (value instanceof Date) return new Date(value.getTime()) as any;
    if (Array.isArray(value)) return value.map((v) => PrismaService.cloneStore(v)) as any;
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) out[k] = PrismaService.cloneStore(v);
      return out;
    }
    return value;
  }

  private createModelMemoryHandler(storeKey: string) {
    const getStore = () => this.memoryStore[storeKey] || [];
    const setStore = (data: any[]) => {
      this.memoryStore[storeKey] = data;
    };

    return {
      findUnique: async ({ where, include, select }: any) => {
        const item = getStore().find((i) => this.matchesWhere(i, where));
        return item ? this.enrichItem(item, storeKey, include, select) : null;
      },
      findUniqueOrThrow: async ({ where, include, select }: any) => {
        const item = getStore().find((i) => this.matchesWhere(i, where));
        if (!item) throw new Error(`No ${storeKey} record found for ${JSON.stringify(where)}`);
        return this.enrichItem(item, storeKey, include, select);
      },
      findFirst: async ({ where, include, select, orderBy }: any) => {
        let items = getStore().filter((i) => this.matchesWhere(i, where));
        if (orderBy) {
          items = this.sortItems(items, orderBy);
        }
        return items.length > 0 ? this.enrichItem(items[0], storeKey, include, select) : null;
      },
      findMany: async ({ where, include, select, orderBy, skip, take }: any = {}) => {
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
        return items.map((i) => this.enrichItem(i, storeKey, include, select));
      },
      create: async ({ data, include, select }: any) => {
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
        return this.enrichItem(newItem, storeKey, include, select);
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
      update: async ({ where, data, include, select }: any) => {
        const index = getStore().findIndex((i) => this.matchesWhere(i, where));
        if (index === -1) throw new Error('Record not found');

        const current = getStore()[index];
        const updated = this.applyUpdate(current, data);

        getStore()[index] = updated;
        return this.enrichItem(updated, storeKey, include, select);
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        const items = getStore();
        for (let i = 0; i < items.length; i++) {
          if (this.matchesWhere(items[i], where)) {
            items[i] = this.applyUpdate(items[i], data);
            count++;
          }
        }
        return { count };
      },
      groupBy: async ({ by, where, _sum, _count, _avg, orderBy, take }: any) => {
        const items = where ? getStore().filter((i) => this.matchesWhere(i, where)) : getStore();
        const keys: string[] = Array.isArray(by) ? by : [by];
        const groups = new Map<string, any>();
        for (const item of items) {
          const groupKey = keys.map((k) => String(item[k])).join('|');
          let group = groups.get(groupKey);
          if (!group) {
            group = {};
            keys.forEach((k) => (group[k] = item[k]));
            groups.set(groupKey, group);
          }
          this.accumulate(group, item, { _sum, _count, _avg });
        }
        let rows = [...groups.values()].map((g) => this.finalizeAggregate(g));
        if (orderBy) {
          const [k, v] = Object.entries(orderBy)[0] as [string, any];
          const pick = (row: any) => (v && typeof v === 'object' ? row[k]?.[Object.keys(v)[0]] ?? 0 : row[k]);
          const dir = (v && typeof v === 'object' ? Object.values(v)[0] : v) === 'desc' ? -1 : 1;
          rows.sort((a, b) => (pick(a) < pick(b) ? -1 : pick(a) > pick(b) ? 1 : 0) * dir);
        }
        if (take !== undefined) rows = rows.slice(0, take);
        return rows;
      },
      aggregate: async ({ where, _sum, _count, _avg }: any = {}) => {
        const items = where ? getStore().filter((i) => this.matchesWhere(i, where)) : getStore();
        const acc: any = {};
        for (const item of items) this.accumulate(acc, item, { _sum, _count, _avg });
        // Prisma returns the requested keys even for an empty set.
        if (_sum) acc._sum = { ...Object.fromEntries(Object.keys(_sum).map((f) => [f, null])), ...(acc._sum ?? {}) };
        if (_count) acc._count = { ...Object.fromEntries(Object.keys(_count).map((f) => [f, 0])), ...(acc._count ?? {}) };
        return this.finalizeAggregate(acc);
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
      upsert: async ({ where, update, create, include, select }: any) => {
        const index = getStore().findIndex((i) => this.matchesWhere(i, where));
        if (index !== -1) {
          const updated = this.applyUpdate(getStore()[index], update);
          getStore()[index] = updated;
          return this.enrichItem(updated, storeKey, include, select);
        }
        const newItem = { id: uuidv4(), created_at: new Date(), updated_at: new Date(), ...create };
        getStore().push(newItem);
        return this.enrichItem(newItem, storeKey, include, select);
      },
    };
  }

  /** Applies Prisma-style update data (plain values plus { increment } / { decrement }). */
  private applyUpdate(current: any, data: any) {
    const updated: any = { ...current, updated_at: new Date() };
    for (const [field, value] of Object.entries(data || {})) {
      if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
        const v = value as any;
        if (v.increment !== undefined) {
          updated[field] = (Number(current[field]) || 0) + Number(v.increment);
          continue;
        }
        if (v.decrement !== undefined) {
          updated[field] = (Number(current[field]) || 0) - Number(v.decrement);
          continue;
        }
        if (v.set !== undefined) {
          updated[field] = v.set;
          continue;
        }
      }
      updated[field] = value;
    }
    return updated;
  }

  private accumulate(acc: any, item: any, ops: { _sum?: any; _count?: any; _avg?: any }) {
    if (ops._count) {
      acc._count = acc._count ?? {};
      for (const f of Object.keys(ops._count)) {
        if (f === '_all' || item[f] !== null && item[f] !== undefined) acc._count[f] = (acc._count[f] ?? 0) + 1;
      }
    }
    if (ops._sum) {
      acc._sum = acc._sum ?? {};
      for (const f of Object.keys(ops._sum)) acc._sum[f] = (acc._sum[f] ?? 0) + (Number(item[f]) || 0);
    }
    if (ops._avg) {
      acc.__avg = acc.__avg ?? {};
      for (const f of Object.keys(ops._avg)) {
        const slot = (acc.__avg[f] = acc.__avg[f] ?? { sum: 0, n: 0 });
        if (item[f] !== null && item[f] !== undefined) {
          slot.sum += Number(item[f]) || 0;
          slot.n += 1;
        }
      }
    }
  }

  private finalizeAggregate(acc: any) {
    if (acc.__avg) {
      acc._avg = Object.fromEntries(
        Object.entries(acc.__avg).map(([f, s]: [string, any]) => [f, s.n ? s.sum / s.n : null]),
      );
      delete acc.__avg;
    }
    return acc;
  }

  private compare(a: any, b: any): number {
    if (a instanceof Date || b instanceof Date || (typeof a === 'string' && typeof b === 'string' && !isNaN(Date.parse(a)) && !isNaN(Date.parse(b)) && isNaN(Number(a)))) {
      return new Date(a).getTime() - new Date(b).getTime();
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  private matchesWhere(item: any, where: any): boolean {
    if (!where) return true;
    for (const key of Object.keys(where)) {
      const val = where[key];
      if (val === undefined) continue;

      if (key === 'OR' && Array.isArray(val)) {
        if (!val.some((cond) => this.matchesWhere(item, cond))) return false;
        continue;
      }
      if (key === 'AND') {
        const conds = Array.isArray(val) ? val : [val];
        if (!conds.every((cond) => this.matchesWhere(item, cond))) return false;
        continue;
      }
      if (key === 'NOT') {
        const conds = Array.isArray(val) ? val : [val];
        if (conds.some((cond) => this.matchesWhere(item, cond))) return false;
        continue;
      }

      if (val === null) {
        if (item[key] !== null && item[key] !== undefined) return false;
        continue;
      }

      if (val && typeof val === 'object' && !(val instanceof Date)) {
        const current = item[key];
        if (val.equals !== undefined && current !== val.equals) return false;
        if (Array.isArray(val.in) && !val.in.includes(current)) return false;
        if (Array.isArray(val.notIn) && val.notIn.includes(current)) return false;
        if (val.not !== undefined) {
          if (val.not === null ? current === null || current === undefined : current === val.not) return false;
        }
        if (val.gte !== undefined && this.compare(current, val.gte) < 0) return false;
        if (val.gt !== undefined && this.compare(current, val.gt) <= 0) return false;
        if (val.lte !== undefined && this.compare(current, val.lte) > 0) return false;
        if (val.lt !== undefined && this.compare(current, val.lt) >= 0) return false;
        if (val.contains !== undefined) {
          if (!String(current ?? '').toLowerCase().includes(String(val.contains).toLowerCase())) return false;
        }
        if (val.startsWith !== undefined) {
          if (!String(current ?? '').toLowerCase().startsWith(String(val.startsWith).toLowerCase())) return false;
        }
        // Relation filters (some/none/every/is/isNot) are not modelled in memory; treat as a match.
      } else if (item[key] !== val) {
        return false;
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

  /**
   * Relation graph of the in-memory store, keyed by Prisma relation field name.
   * `many` relations resolve to arrays; `one` relations to a single row or null.
   */
  private relationResolvers(storeKey: string): Record<string, { many: boolean; store: string; resolve: (item: any) => any[] }> {
    const rows = (store: string) => this.memoryStore[store] || [];
    const byField = (store: string, field: string, value: any) => rows(store).filter((r) => r[field] === value);
    const byId = (store: string, id: any) => rows(store).filter((r) => r.id === id);
    const one = (store: string, resolve: (item: any) => any[]) => ({ many: false, store, resolve });
    const many = (store: string, resolve: (item: any) => any[]) => ({ many: true, store, resolve });

    switch (storeKey) {
      case 'users':
        return {
          shops: many('shops', (u) => byField('shops', 'owner_id', u.id)),
          addresses: many('addresses', (u) => byField('addresses', 'user_id', u.id)),
          orders: many('orders', (u) => byField('orders', 'customer_id', u.id)),
          reviews: many('orderReviews', (u) => byField('orderReviews', 'customer_id', u.id)),
          device_tokens: many('deviceTokens', (u) => byField('deviceTokens', 'user_id', u.id)),
          refresh_tokens: many('refreshTokens', (u) => byField('refreshTokens', 'user_id', u.id)),
          audit_logs: many('auditLogs', (u) => byField('auditLogs', 'actor_id', u.id)),
        };
      case 'shops':
        return {
          owner: one('users', (s) => byId('users', s.owner_id)),
          city: one('cities', (s) => byId('cities', s.city_id)),
          products: many('products', (s) => byField('products', 'shop_id', s.id)),
          orders: many('orders', (s) => byField('orders', 'shop_id', s.id)),
          carts: many('carts', (s) => byField('carts', 'shop_id', s.id)),
        };
      case 'cities':
        return {
          shops: many('shops', (c) => byField('shops', 'city_id', c.id)),
          addresses: many('addresses', (c) => byField('addresses', 'city_id', c.id)),
        };
      case 'products':
        return {
          category: one('categories', (p) => byId('categories', p.category_id)),
          shop: one('shops', (p) => byId('shops', p.shop_id)),
        };
      case 'categories':
        return {
          parent: one('categories', (c) => byId('categories', c.parent_id)),
          children: many('categories', (c) => byField('categories', 'parent_id', c.id)),
          products: many('products', (c) => byField('products', 'category_id', c.id)),
        };
      case 'addresses':
        return {
          user: one('users', (a) => byId('users', a.user_id)),
          city: one('cities', (a) => byId('cities', a.city_id)),
        };
      case 'carts':
        return {
          user: one('users', (c) => byId('users', c.user_id)),
          shop: one('shops', (c) => byId('shops', c.shop_id)),
          items: many('cartItems', (c) => byField('cartItems', 'cart_id', c.id)),
        };
      case 'cartItems':
        return {
          cart: one('carts', (ci) => byId('carts', ci.cart_id)),
          product: one('products', (ci) => byId('products', ci.product_id)),
        };
      case 'orders':
        return {
          customer: one('users', (o) => byId('users', o.customer_id)),
          shop: one('shops', (o) => byId('shops', o.shop_id)),
          items: many('orderItems', (o) => byField('orderItems', 'order_id', o.id)),
          status_history: many('orderStatusHistories', (o) => byField('orderStatusHistories', 'order_id', o.id)),
          payments: many('payments', (o) => byField('payments', 'order_id', o.id)),
          review: one('orderReviews', (o) => byField('orderReviews', 'order_id', o.id)),
        };
      case 'orderReviews':
        return {
          order: one('orders', (r) => byId('orders', r.order_id)),
          customer: one('users', (r) => byId('users', r.customer_id)),
        };
      case 'orderItems':
        return {
          order: one('orders', (oi) => byId('orders', oi.order_id)),
          product: one('products', (oi) => byId('products', oi.product_id)),
        };
      case 'orderStatusHistories':
        return {
          order: one('orders', (h) => byId('orders', h.order_id)),
          actor: one('users', (h) => byId('users', h.changed_by)),
        };
      case 'payments':
        return { order: one('orders', (p) => byId('orders', p.order_id)) };
      case 'auditLogs':
        return { actor: one('users', (a) => byId('users', a.actor_id)) };
      case 'refreshTokens':
      case 'deviceTokens':
      case 'notifications':
        return { user: one('users', (r) => byId('users', r.user_id)) };
      default:
        return {};
    }
  }

  /** Resolves one relation for `item`, honouring nested include/select/where/orderBy/skip/take. */
  private resolveRelation(
    rel: { many: boolean; store: string; resolve: (item: any) => any[] },
    item: any,
    spec: any,
    defaultNested?: any,
  ): any {
    const args = spec && typeof spec === 'object' ? spec : defaultNested || {};
    let related = rel.resolve(item);
    if (args.where) related = related.filter((r) => this.matchesWhere(r, args.where));
    if (args.orderBy) related = this.sortItems(related, args.orderBy);
    if (args.skip !== undefined) related = related.slice(args.skip);
    if (args.take !== undefined) related = related.slice(0, args.take);
    const enriched = related.map((r) => this.enrichItem(r, rel.store, args.include, args.select));
    return rel.many ? enriched : enriched[0] ?? null;
  }

  private countRelations(storeKey: string, item: any, spec: any): Record<string, number> {
    const relations = this.relationResolvers(storeKey);
    const wanted = spec && typeof spec === 'object' && spec.select ? spec.select : null;
    const keys = wanted ? Object.keys(wanted).filter((k) => wanted[k]) : Object.keys(relations).filter((k) => relations[k].many);
    const counts: Record<string, number> = {};
    for (const key of keys) {
      const rel = relations[key];
      if (!rel) continue;
      let related = rel.resolve(item);
      const where = wanted && wanted[key] && typeof wanted[key] === 'object' ? wanted[key].where : undefined;
      if (where) related = related.filter((r) => this.matchesWhere(r, where));
      counts[key] = related.length;
    }
    return counts;
  }

  /**
   * Mirrors Prisma's `include` / `select` shaping on a plain row: relations are
   * resolved from the memory store (recursively), `_count` is computed, and with
   * `select` only the requested scalar fields are returned.
   */
  private enrichItem(item: any, storeKey: string, include?: any, select?: any): any {
    const spec = select || include;
    if (!spec) return { ...item };

    const relations = this.relationResolvers(storeKey);
    const out: any = select ? {} : { ...item };

    for (const [key, value] of Object.entries(spec)) {
      if (!value) continue;
      if (key === '_count') {
        out._count = this.countRelations(storeKey, item, value);
        continue;
      }
      const rel = relations[key];
      if (rel) {
        // Carts historically came back with each item's product attached; keep that default.
        const defaultNested = storeKey === 'carts' && key === 'items' ? { include: { product: true } } : undefined;
        out[key] = this.resolveRelation(rel, item, value, defaultNested);
        continue;
      }
      if (select) out[key] = item[key];
    }

    return out;
  }
}
