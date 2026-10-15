import { create } from 'zustand';

export interface CartItem {
  product: {
    id: string;
    name_uz: string;
    name_ru?: string;
    name_en?: string;
    price: number; // in tiyin
    image_url?: string;
    stock: number;
    shop_id: string;
    unit?: string;
    description_uz?: string;
    description_ru?: string;
    description_en?: string;
  };
  quantity: number;
}

/** Promo codes accepted by the server (validated again server-side on order creation) */
export const PROMO_CODES: Record<string, number> = {
  YANGI10: 10,
  LOCALSHOP: 10,
  TEZ10: 10,
};

export interface AppliedPromo {
  code: string;
  percent: number;
}

interface CartState {
  shopId: string | null;
  shopName: string | null;
  items: CartItem[];
  promo: AppliedPromo | null;
  applyPromo: (code: string) => boolean;
  clearPromo: () => void;
  getDiscountAmount: () => number;
  setItemQuantity: (product: any, shopId: string, shopName: string, quantity: number) => { conflict: boolean };
  addItem: (product: any, shopId: string, shopName: string, quantity?: number) => { conflict: boolean };
  increment: (productOrId: any, shopId?: string, shopName?: string) => { conflict: boolean };
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  reorder: (items: CartItem[], shopId: string, shopName: string) => void;
  getItemQuantity: (productId: string) => number;
  getTotalAmount: () => number;
  getTotalItemsCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  shopId: null,
  shopName: null,
  items: [],
  promo: null,

  applyPromo: (code) => {
    const normalized = code.trim().toUpperCase();
    const percent = PROMO_CODES[normalized];
    if (!percent) return false;
    set({ promo: { code: normalized, percent } });
    return true;
  },

  clearPromo: () => set({ promo: null }),

  getDiscountAmount: () => {
    const promo = get().promo;
    if (!promo) return 0;
    return Math.round((get().getTotalAmount() * promo.percent) / 100);
  },

  setItemQuantity: (product, shopId, shopName, quantity) => {
    const currentShopId = get().shopId;
    if (currentShopId && currentShopId !== shopId && get().items.length > 0) {
      return { conflict: true };
    }
    if (quantity <= 0) {
      get().removeItem(product.id);
      return { conflict: false };
    }
    const items = [...get().items];
    const existingIndex = items.findIndex((i) => i.product.id === product.id);
    if (existingIndex > -1) {
      items[existingIndex] = { ...items[existingIndex], quantity };
    } else {
      items.push({ product, quantity });
    }
    set({ shopId, shopName, items });
    return { conflict: false };
  },

  addItem: (product, shopId, shopName, quantity = 1) => {
    const currentShopId = get().shopId;

    // Single-shop enforcement
    if (currentShopId && currentShopId !== shopId && get().items.length > 0) {
      return { conflict: true };
    }

    const items = [...get().items];
    const existingIndex = items.findIndex((i) => i.product.id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({ product, quantity });
    }

    set({ shopId, shopName, items });
    return { conflict: false };
  },

  increment: (productOrId, shopId, shopName) => {
    if (typeof productOrId === 'string') {
      const items = [...get().items];
      const existingIndex = items.findIndex((i) => i.product.id === productOrId);
      if (existingIndex > -1) {
        items[existingIndex].quantity += 1;
        set({ items });
      }
      return { conflict: false };
    }
    return get().addItem(productOrId, shopId || get().shopId || '', shopName || get().shopName || '');
  },

  decrement: (productId) => {
    const items = [...get().items];
    const existingIndex = items.findIndex((i) => i.product.id === productId);

    if (existingIndex > -1) {
      if (items[existingIndex].quantity > 1) {
        items[existingIndex].quantity -= 1;
        set({ items });
      } else {
        get().removeItem(productId);
      }
    }
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.product.id !== productId);
    set({
      items,
      shopId: items.length === 0 ? null : get().shopId,
      shopName: items.length === 0 ? null : get().shopName,
      promo: items.length === 0 ? null : get().promo,
    });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const items = get().items.map((i) =>
      i.product.id === productId ? { ...i, quantity } : i,
    );
    set({ items });
  },

  clearCart: () => {
    set({ shopId: null, shopName: null, items: [], promo: null });
  },

  reorder: (items, shopId, shopName) => {
    set({ shopId, shopName, items, promo: null });
  },

  getItemQuantity: (productId) => {
    const item = get().items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  },

  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  },

  getTotalItemsCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
