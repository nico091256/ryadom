import { create } from 'zustand';

export interface DeliveryAddress {
  id?: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  door_code?: string | null;
}

/** "Podyezd 2, Qavat 5, Xonadon 45" — empty string when no details are set */
export function formatAddressDetails(a: Partial<DeliveryAddress>): string {
  return [
    a.entrance && `Podyezd ${a.entrance}`,
    a.floor && `Qavat ${a.floor}`,
    a.apartment && `Xonadon ${a.apartment}`,
    a.door_code && `Domofon ${a.door_code}`,
  ]
    .filter(Boolean)
    .join(', ');
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
