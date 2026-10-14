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
  };
  quantity: number;
}

interface CartState {
  shopId: string | null;
  shopName: string | null;
  items: CartItem[];
  addItem: (product: any, shopId: string, shopName: string) => { conflict: boolean };
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  shopId: null,
  shopName: null,
  items: [],

  addItem: (product, shopId, shopName) => {
    const currentShopId = get().shopId;

    // Single-shop enforcement
    if (currentShopId && currentShopId !== shopId && get().items.length > 0) {
      return { conflict: true };
    }

    const items = [...get().items];
    const existingIndex = items.findIndex((i) => i.product.id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity += 1;
    } else {
      items.push({ product, quantity: 1 });
    }

    set({ shopId, shopName, items });
    return { conflict: false };
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.product.id !== productId);
    set({
      items,
      shopId: items.length === 0 ? null : get().shopId,
      shopName: items.length === 0 ? null : get().shopName,
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
    set({ shopId: null, shopName: null, items: [] });
  },

  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  },
}));
