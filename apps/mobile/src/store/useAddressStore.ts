import { create } from 'zustand';

export interface DeliveryAddress {
  id?: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
}

interface AddressState {
  currentAddress: DeliveryAddress;
  savedAddresses: DeliveryAddress[];
  setCurrentAddress: (addr: DeliveryAddress) => void;
  setSavedAddresses: (addresses: DeliveryAddress[]) => void;
}

export const useAddressStore = create<AddressState>((set) => ({
  currentAddress: {
    title: 'Uy',
    address_text: 'Toshkent sh., Chilonzor 5-mavze, 12-uy',
    lat: 41.2840,
    lng: 69.2160,
  },
  savedAddresses: [],
  setCurrentAddress: (addr) => set({ currentAddress: addr }),
  setSavedAddresses: (addresses) => set({ savedAddresses: addresses }),
}));
