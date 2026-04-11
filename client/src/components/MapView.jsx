/**
 * MapView — Reusable Mapbox GL JS wrapper
 *
 * Props:
 *   center      [lng, lat]        Map center coordinates (default: center of India)
 *   zoom        number            Initial zoom level
 *   markers     Array<{lng, lat, color?, severity?, popup?, onClick?}>
 *   onMapClick  ({lng, lat}) =>   Called when the user clicks on the map
 *   interactive boolean           Whether pan/zoom controls are enabled
 */
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function MapView({
    center = [78.9629, 20.5937],
    zoom = 13,
    markers = [],
    onMapClick,
    onBoundsChange,
    interactive = true,
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const onMapClickRef = useRef(onMapClick);
    const onBoundsChangeRef = useRef(onBoundsChange);

    // Keep click callback ref fresh without re-initialising the map
    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
        onBoundsChangeRef.current = onBoundsChange;
    }, [onBoundsChange]);

    // --- Initialise map once ---
    useEffect(() => {
        if (!containerRef.current || !TOKEN) return;

        mapboxgl.accessToken = TOKEN;
        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center,
            zoom,
            interactive,
            attributionControl: false,
        });

        if (interactive) {
            map.addControl(
                new mapboxgl.NavigationControl({ showCompass: false }),
                'top-right',
            );
        }

        map.on('click', (e) => {
            onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        });

        const fireBounds = () => {
            const b = map.getBounds();
            onBoundsChangeRef.current?.({
                minLng: b.getWest(),
                maxLng: b.getEast(),
                minLat: b.getSouth(),
                maxLat: b.getNorth(),
            });
        };
        map.on('moveend', fireBounds);
        map.once('load', fireBounds);

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Pan to new center ---
    useEffect(() => {
        mapRef.current?.setCenter(center);
    }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Sync markers ---
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const render = () => {
            // Remove old markers
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];

            markers.forEach(({ lng, lat, color, severity, popup: html, onClick }) => {
                if (lng == null || lat == null) return;

                const el = document.createElement('div');
                el.style.cssText = [
                    'width:14px',
                    'height:14px',
                    'border-radius:50%',
                    `background:${color ?? severityColor(severity)}`,
                    'border:2.5px solid #fff',
                    'box-shadow:0 2px 6px rgba(0,0,0,.4)',
                    onClick ? 'cursor:pointer' : '',
                ].join(';');

                if (onClick) {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onClick();
                    });
                }

                const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]);

                if (html) {
                    marker.setPopup(
                        new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(html),
                    );
                }

                marker.addTo(map);
                markersRef.current.push(marker);
            });
        };

        if (map.loaded()) {
            render();
        } else {
            map.once('load', render);
            return () => map.off('load', render);
        }
    }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- No token fallback ---
    if (!TOKEN) {
        return (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-center p-4">
                <div>
                    <p className="text-2xl mb-2">🗺️</p>
                    <p className="text-xs text-gray-500">
                        Map unavailable.
                        <br />
                        Add <code className="bg-gray-200 px-1 rounded">VITE_MAPBOX_TOKEN</code> to{' '}
                        <code className="bg-gray-200 px-1 rounded">.env</code>
                    </p>
                </div>
            </div>
        );
    }

    return <div ref={containerRef} className="w-full h-full" />;
}

/** Returns a Tailwind-compatible hex colour based on severity score 1–10. */
export function severityColor(score) {
    if (!score) return '#6b7280';
    if (score >= 8) return '#dc2626'; // red   — critical
    if (score >= 6) return '#f97316'; // orange — high
    if (score >= 4) return '#f59e0b'; // amber  — medium
    return '#22c55e'; // green  — low
}

export default MapView;
