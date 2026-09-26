import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapBounds, MapMarkerData, MapProvider } from '../../types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}

export class LeafletMapProvider implements MapProvider {
  private map: L.Map | null = null;
  private markersMap = new Map<string, L.Marker>();
  private isDestroyed = false;
  private currentContainer: HTMLElement | null = null;

  async renderMap(container: HTMLElement, center: { lat: number; lng: number }, zoom: number = 13): Promise<void> {
    this.isDestroyed = false;
    this.currentContainer = container;

    if (this.isDestroyed || !container) return;

    // Clean up previous map instance if any
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {}
      this.map = null;
    }

    // Leaflet assigns an internal property `_leaflet_id` to container.
    // Reset it so Leaflet won't throw "Map container is already initialized"
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      // Initialize Leaflet map with bundled Leaflet
      this.map = L.map(container, {
        zoomControl: true,
        attributionControl: false
      }).setView([center.lat, center.lng], zoom);

      // High quality modern tile layer (CartoDB Positron / OSM clean)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(this.map);
    } catch (err: any) {
      console.warn('Leaflet initialization handled:', err?.message);
      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = null;
        try {
          this.map = L.map(container, {
            zoomControl: true,
            attributionControl: false
          }).setView([center.lat, center.lng], zoom);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
          }).addTo(this.map);
        } catch (retryErr) {
          console.error('Failed to retry Leaflet init:', retryErr);
        }
      }
    }
  }

  addMarker(marker: MapMarkerData, onClick: (marker: MapMarkerData) => void): void {
    if (!this.map) return;

    // Color definitions based on availability
    let statusColor = '#10b981'; // Green: today
    if (marker.availabilityStatus === 'tomorrow') {
      statusColor = '#f59e0b'; // Amber: tomorrow
    } else if (marker.availabilityStatus === 'none') {
      statusColor = '#94a3b8'; // Slate: no slots
    } else if (marker.availabilityStatus === 'closed') {
      statusColor = '#ef4444'; // Red: closed
    }

    const isToday = marker.availabilityStatus === 'today';
    const isPromoted = marker.isPromoted;

    const html = `
      <div class="cursor-pointer group flex flex-col items-center transition-all duration-300 hover:scale-110">
        <div class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-lg border text-white font-medium text-xs backdrop-blur-md transition-all ${
          isPromoted ? 'border-amber-400 shadow-amber-500/30' : 'border-slate-800/80 shadow-slate-900/30'
        }" style="background-color: #0f172a;">
          ${isPromoted ? '<span class="text-amber-400 text-[10px]">★</span>' : ''}
          <span class="inline-block w-2.5 h-2.5 rounded-full ${isToday ? 'animate-pulse' : ''}" style="background-color: ${statusColor};"></span>
           <span class="tracking-tight whitespace-nowrap text-slate-100 font-semibold">${escapeHtml(marker.name)}</span>
          <span class="text-[11px] font-bold text-amber-400">★ ${marker.rating.toFixed(1)}</span>
        </div>
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-slate-900 -mt-[1px]"></div>
      </div>
    `;

    const customIcon = L.divIcon({
      html,
      className: 'stobook-custom-marker',
      iconSize: [140, 42],
      iconAnchor: [70, 40]
    });

    const lMarker = L.marker([marker.lat, marker.lng], { icon: customIcon }).addTo(this.map);

    lMarker.on('click', () => {
      onClick(marker);
    });

    this.markersMap.set(marker.id, lMarker);
  }

  removeMarker(markerId: string): void {
    const m = this.markersMap.get(markerId);
    if (m && this.map) {
      this.map.removeLayer(m);
      this.markersMap.delete(markerId);
    }
  }

  clearMarkers(): void {
    if (!this.map) return;
    this.markersMap.forEach((m) => this.map?.removeLayer(m));
    this.markersMap.clear();
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    if (!this.map) return;
    if (zoom) {
      this.map.setView([lat, lng], zoom, { animate: true });
    } else {
      this.map.panTo([lat, lng], { animate: true });
    }
  }

  fitBounds(bounds: MapBounds): void {
    if (!this.map) return;
    this.map.fitBounds(
      L.latLngBounds([
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng]
      ]),
      { padding: [50, 50] }
    );
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {}
      this.map = null;
    }
    if (this.currentContainer && (this.currentContainer as any)._leaflet_id) {
      (this.currentContainer as any)._leaflet_id = null;
    }
    this.currentContainer = null;
    this.markersMap.clear();
  }
}

// Factory to create configured provider
export function createMapProvider(providerName: string = 'osm'): MapProvider {
  return new LeafletMapProvider();
}
