'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

type Placement = {
  lat: number;
  lng: number;
};

interface StreetViewPlacementProps {
  mapsLoaded: boolean;
  mapsUnavailable: boolean;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
  onPlacementChange: (placement: Placement) => void;
}

export function StreetViewPlacement({
  mapsLoaded,
  mapsUnavailable,
  address,
  addressLat,
  addressLng,
  onPlacementChange,
}: StreetViewPlacementProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const panoramaRef = useRef<any>(null);
  const streetViewServiceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const panoramaContainerRef = useRef<HTMLDivElement>(null);
  const [placementStatus, setPlacementStatus] = useState('Enter an address to begin placement.');
  const [findingPlacement, setFindingPlacement] = useState(false);

  const placementAvailable = typeof addressLat === 'number' && typeof addressLng === 'number';

  const syncPlacement = (lat: number, lng: number) => {
    onPlacementChange({ lat, lng });
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    }
    if (panoramaRef.current) {
      panoramaRef.current.setPosition({ lat, lng });
    }
  };

  const attachStreetView = (lat: number, lng: number) => {
    if (!streetViewServiceRef.current || !panoramaRef.current) {
      return;
    }

    streetViewServiceRef.current.getPanorama(
      {
        location: { lat, lng },
        radius: 60,
        source: window.google.maps.StreetViewSource.OUTDOOR,
      },
      (result: any, status: any) => {
        if (status === window.google.maps.StreetViewStatus.OK && result?.location?.pano) {
          panoramaRef.current.setPano(result.location.pano);
          panoramaRef.current.setPov({ heading: 0, pitch: 0 });
          panoramaRef.current.setVisible(true);
          setPlacementStatus('Drag the pin on the map to refine exact sign placement.');
        } else {
          panoramaRef.current.setPosition({ lat, lng });
          panoramaRef.current.setVisible(true);
          setPlacementStatus('Street View not available at this exact spot. Move the pin to nearby streets.');
        }
      }
    );
  };

  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || !panoramaContainerRef.current || !placementAvailable) {
      return;
    }

    const center = { lat: addressLat as number, lng: addressLng as number };

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 19,
        mapTypeId: 'satellite',
        streetViewControl: false,
        fullscreenControl: false,
      });

      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: center,
        draggable: true,
        title: 'Sign placement',
      });

      panoramaRef.current = new window.google.maps.StreetViewPanorama(
        panoramaContainerRef.current,
        {
          position: center,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: true,
        }
      );

      geocoderRef.current = new window.google.maps.Geocoder();
      streetViewServiceRef.current = new window.google.maps.StreetViewService();

      mapRef.current.addListener('click', (event: any) => {
        if (!event.latLng) return;
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        syncPlacement(lat, lng);
        attachStreetView(lat, lng);
      });

      markerRef.current.addListener('dragend', (event: any) => {
        if (!event.latLng) return;
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        syncPlacement(lat, lng);
        attachStreetView(lat, lng);
      });
    }

    mapRef.current.setCenter(center);
    mapRef.current.setZoom(19);
    syncPlacement(center.lat, center.lng);
    attachStreetView(center.lat, center.lng);
  }, [mapsLoaded, placementAvailable, addressLat, addressLng]);

  const handleFindPlacement = () => {
    if (!mapsLoaded || !address.trim()) {
      setPlacementStatus('Enter a valid address first.');
      return;
    }
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }

    setFindingPlacement(true);

    geocoderRef.current.geocode({ address }, (results: any[], status: any) => {
      setFindingPlacement(false);
      if (status !== 'OK' || !results?.length || !results[0]?.geometry?.location) {
        setPlacementStatus('Could not locate this address. Adjust it and try again.');
        return;
      }

      const location = results[0].geometry.location;
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

      syncPlacement(lat, lng);
      if (mapRef.current) {
        mapRef.current.setCenter({ lat, lng });
      }
      attachStreetView(lat, lng);
      setPlacementStatus('Address located. Fine-tune the pin for exact sign placement.');
    });
  };

  if (mapsUnavailable) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Street View placement is unavailable because Google Maps is not configured.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">Street View Sign Placement</h3>
          <p className="text-sm text-slate-600">Set the exact spot where the sign post should be installed.</p>
        </div>
        <button
          type="button"
          onClick={handleFindPlacement}
          disabled={!mapsLoaded || findingPlacement || !address.trim()}
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {findingPlacement ? 'Locating...' : 'Locate Address'}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <div ref={mapContainerRef} className="h-72 w-full" />
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <div ref={panoramaContainerRef} className="h-72 w-full" />
        </div>
      </div>

      <p className="text-xs text-slate-500">{placementStatus}</p>
      <p className="text-xs text-slate-600">
        Tip: Click map or drag pin to adjust. Saved placement: {placementAvailable ? `${addressLat?.toFixed(6)}, ${addressLng?.toFixed(6)}` : 'Not set'}
      </p>
    </div>
  );
}
