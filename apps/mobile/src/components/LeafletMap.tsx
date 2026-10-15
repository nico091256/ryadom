import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  open?: boolean;
}

export interface LeafletMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** Picker mode: fixed pin in the middle, reports the map center when the user stops dragging */
  picker?: boolean;
  /** Blue dot for the user's position */
  userLocation?: { lat: number; lng: number } | null;
  onCenterChange?: (lat: number, lng: number) => void;
  onMarkerPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Translated UI strings inside the map; defaults come from the current i18n language */
  labels?: { openShop?: string };
}

const buildHtml = (opts: { lat: number; lng: number; zoom: number; picker: boolean }) => `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #e5e7eb; }
  .shop-pin { width: 34px; height: 34px; border-radius: 17px 17px 17px 4px; transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
    box-shadow: 0 3px 8px rgba(0,0,0,.3); }
  .shop-pin span { transform: rotate(45deg); font-size: 16px; }
  .shop-pin.open { background: #16a34a; } .shop-pin.closed { background: #94a3b8; }
  .user-dot { width: 16px; height: 16px; border-radius: 8px; background: #2563eb; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(37,99,235,.25); }
  .center-pin { position: absolute; left: 50%; top: 50%; z-index: 1000; pointer-events: none;
    transform: translate(-50%, -100%); transition: transform .15s; }
  .center-pin.lift { transform: translate(-50%, -120%); }
  .center-pin svg { filter: drop-shadow(0 4px 4px rgba(0,0,0,.3)); }
  .center-shadow { position: absolute; left: 50%; top: 50%; z-index: 999; width: 10px; height: 4px;
    border-radius: 50%; background: rgba(0,0,0,.3); transform: translate(-50%, -50%); pointer-events: none; }
  .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
  .pp-title { font-weight: 800; font-size: 14px; color: #0f172a; }
  .pp-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .pp-btn { margin-top: 8px; width: 100%; border: 0; border-radius: 10px; padding: 8px; background: #16a34a;
    color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
</style>
</head><body>
<div id="map"></div>
${opts.picker ? `<div class="center-shadow"></div><div class="center-pin" id="cpin">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#16a34a" stroke="#fff" stroke-width="1.5">
  <path d="M12 2C8 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg></div>` : ''}
<script>
  function send(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent !== window) window.parent.postMessage({ __leaflet: true, data: s }, '*');
  }
  var map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([${opts.lat}, ${opts.lng}], ${opts.zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var userMarker = null;
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  window.setMarkers = function (list) {
    markerLayer.clearLayers();
    list.forEach(function (m) {
      var icon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32],
        html: '<div class="shop-pin ' + (m.open === false ? 'closed' : 'open') + '"><span>🏪</span></div>' });
      var mk = L.marker([m.lat, m.lng], { icon: icon }).addTo(markerLayer);
      var html = '<div class="pp-title">' + esc(m.title) + '</div>' +
        (m.subtitle ? '<div class="pp-sub">' + esc(m.subtitle) + '</div>' : '') +
        '<button class="pp-btn" onclick="send({type:\\'marker\\',id:\\'' + esc(m.id) + '\\'})">' + esc(m.btn) + '</button>';
      mk.bindPopup(html, { closeButton: false });
    });
  };
  window.setUser = function (p) {
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    if (!p) return;
    userMarker = L.marker([p.lat, p.lng], { interactive: false,
      icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="user-dot"></div>' })
    }).addTo(map);
  };
  window.flyTo = function (lat, lng, zoom) { map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 0.8 }); };

  var cpin = document.getElementById('cpin');
  map.on('movestart', function () { if (cpin) cpin.classList.add('lift'); });
  map.on('moveend', function () {
    if (cpin) cpin.classList.remove('lift');
    var c = map.getCenter();
    send({ type: 'move', lat: c.lat, lng: c.lng });
  });

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== window.parent || !d || !d.__leafletCmd) return;
    try { (new Function(d.code))(); } catch (err) {}
  });
  send({ type: 'ready' });
</script>
</body></html>`;

const LeafletMap = forwardRef<LeafletMapHandle, Props>(function LeafletMap(
  { center, zoom = 15, markers = [], picker = false, userLocation, onCenterChange, onMarkerPress, style, labels },
  ref,
) {
  const { t } = useTranslation();
  // Popup button text travels with every marker so it follows language switches
  const openShopLabel = labels?.openShop ?? t('customer.map.openShop');
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const readyRef = useRef(false);
  const lastCenter = useRef(center);
  const handlers = useRef({ onCenterChange, onMarkerPress });
  handlers.current = { onCenterChange, onMarkerPress };

  // HTML is built once with the initial center; later moves go through flyTo
  const html = useMemo(() => buildHtml({ lat: center.lat, lng: center.lng, zoom, picker }), []);

  const run = (code: string) => {
    if (!readyRef.current) return;
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage({ __leafletCmd: true, code }, '*');
    } else {
      webRef.current?.injectJavaScript(`${code};true;`);
    }
  };

  const pushState = () => {
    run(`window.setMarkers(${JSON.stringify(markers.map((m) => ({ ...m, btn: openShopLabel })))})`);
    run(`window.setUser(${JSON.stringify(userLocation || null)})`);
  };

  const handleMessage = (raw: string) => {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      readyRef.current = true;
      pushState();
    } else if (msg.type === 'move') {
      lastCenter.current = { lat: msg.lat, lng: msg.lng };
      handlers.current.onCenterChange?.(msg.lat, msg.lng);
    } else if (msg.type === 'marker') {
      handlers.current.onMarkerPress?.(msg.id);
    }
  };

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z) => run(`window.flyTo(${lat}, ${lng}, ${z ?? 'undefined'})`),
  }));

  useEffect(() => {
    pushState();
  }, [markers, userLocation, openShopLabel]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.__leaflet) handleMessage(e.data.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[{ overflow: 'hidden' }, style]}>
        {React.createElement('iframe', {
          ref: iframeRef,
          srcDoc: html,
          style: { border: 0, width: '100%', height: '100%' },
          allow: 'geolocation',
        })}
      </View>
    );
  }

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(e) => handleMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1 }}
      />
    </View>
  );
});

export default LeafletMap;
