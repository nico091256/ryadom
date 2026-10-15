import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface DetectedLocation {
  lat: number;
  lng: number;
  address_text: string;
}

export class LocationPermissionError extends Error {}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((p, i, arr) => p && arr.indexOf(p) === i).join(', ');
}

async function reverseGeocodeNative(lat: number, lng: number): Promise<string | null> {
  const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  if (!place) return null;
  const street = place.street
    ? joinParts([place.street, place.streetNumber])
    : place.name;
  return joinParts([place.city || place.region, place.district || place.subregion, street]) || null;
}

// OpenStreetMap fallback — expo-location has no reverse geocoding on web
async function reverseGeocodeOsm(lat: number, lng: number, lang: string): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=18`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address || {};
  const street = a.road ? joinParts([a.road, a.house_number]) : a.neighbourhood;
  const text = joinParts([a.city || a.town || a.state, a.suburb || a.city_district || a.county, street]);
  return text || data.display_name || null;
}

export async function detectCurrentLocation(lang = 'uz'): Promise<DetectedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError('Location permission denied');
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  return { lat, lng, address_text: await reverseGeocode(lat, lng, lang) };
}

export async function reverseGeocode(lat: number, lng: number, lang = 'uz'): Promise<string> {
  let address: string | null = null;
  if (Platform.OS !== 'web') {
    try {
      address = await reverseGeocodeNative(lat, lng);
    } catch {
      address = null;
    }
  }
  if (!address) {
    try {
      address = await reverseGeocodeOsm(lat, lng, lang);
    } catch {
      address = null;
    }
  }

  return address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
