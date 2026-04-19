<<<<<<< HEAD
/**
=======
﻿/**
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
 * CitizenReportPage — Liquid Glass Design
 *
 * Features:
 * ✅ Camera / file upload with live preview
 * ✅ Auto-detect GPS via navigator.geolocation
 * ✅ Click-to-reposition map pin
 * ✅ Description textarea (max 500 chars)
 * ✅ POST /api/tickets via Axios with loading state
 * ✅ Success / error feedback via react-hot-toast
 * ✅ Responsive — designed thumb-friendly at 375 px
 */
import { useState, useEffect, useRef } from 'react';
<<<<<<< HEAD
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
=======
import { Link } from 'react-router-dom';
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
import toast from 'react-hot-toast';
import { debugLog } from '../utils/debug';

/** Compress a camera image to max 1280px and ~80% quality before upload.
 *  Reduces typical phone photos from 5-10 MB down to 200-500 KB. */
function compressImage(file, maxPx = 1280, quality = 0.82) {
    return new Promise((resolve) => {
        const img = new Image();
        const blobUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            const { naturalWidth: w, naturalHeight: h } = img;
            const scale = Math.min(1, maxPx / Math.max(w, h));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' })),
                'image/jpeg',
                quality,
            );
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
        img.src = blobUrl;
    });
}
import MapView from '../components/MapView';
import { submitTicket } from '../services/api';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const HERO_PHRASES = ['a pothole?', 'garbage dumping?', 'a broken streetlight?', 'waterlogging?', 'illegal encroachment?'];

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function CitizenReportPage() {
<<<<<<< HEAD
    const navigate = useNavigate();
    const { isUserAuthenticated } = useAuth();
=======
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
    const [photo, setPhoto] = useState(null);
    const [preview, setPreview] = useState(null);
    const [description, setDescription] = useState('');
    const [coords, setCoords] = useState(null);
    const [locating, setLocating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [listening, setListening] = useState(false);
    const [heroIdx, setHeroIdx] = useState(0);
    const [morphState, setMorphState] = useState('idle'); // idle | morphing | success
    const recognitionRef = useRef(null);

    const toggleVoice = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { toast.error('Voice input not supported in this browser.'); return; }
        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-IN';
        rec.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ');
            setDescription(prev => (prev ? prev + ' ' : '') + transcript);
        };
        rec.onend = () => setListening(false);
        rec.start();
        recognitionRef.current = rec;
        setListening(true);
        toast('Listening… tap mic to stop', { icon: '🎙️' });
    };

    // Restore photo from sessionStorage on mount (mobile camera wipes React state)
    useEffect(() => {
        const stored = sessionStorage.getItem('pending_photo_b64');
        if (stored) {
            try {
                const mime = stored.match(/data:(.*?);/)?.[1] || 'image/jpeg';
                const binary = atob(stored.split(',')[1]);
                const bytes = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i));
                const file = new File([bytes], 'photo.jpg', { type: mime });
                setPhoto(file);
                setPreview(stored); // base64 previews survive reloads
            } catch {
                sessionStorage.removeItem('pending_photo_b64');
            }
        }
    }, []);

    useEffect(() => {
        // Revoke blob URLs only (base64 preview strings need no revocation)
        return () => { if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview); };
    }, [preview]);

    useEffect(() => {
        const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_PHRASES.length), 2600);
        return () => clearInterval(t);
    }, []);

    // --- Handlers ---
    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        let compressed;
        try {
            toast.loading('Processing image…', { id: 'compress' });
            compressed = await compressImage(file);
            toast.dismiss('compress');
        } catch {
            toast.dismiss('compress');
            compressed = file;
        }

        if (compressed.size > MAX_FILE_BYTES) {
            toast.error('Image too large. Max 5 MB.');
            return;
        }

        const previewUrl = URL.createObjectURL(compressed);
        setPhoto(compressed);
        setPreview(previewUrl);

        // Persist to sessionStorage so state survives mobile camera app switching
        try {
            const reader = new FileReader();
            reader.onload = () => {
                try { sessionStorage.setItem('pending_photo_b64', reader.result); } catch {}
            };
            reader.readAsDataURL(compressed);
        } catch {}
    };

    const clearPhoto = () => {
        setPhoto(null);
        setPreview(null);
        sessionStorage.removeItem('pending_photo_b64');
    };

    const detectGPS = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation not supported by this browser.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords: { longitude, latitude } }) => {
                setCoords({ lng: longitude, lat: latitude });
                setLocating(false);
                toast.success('Location detected!');
            },
            () => {
                setLocating(false);
<<<<<<< HEAD
                toast.error('Could not get location. Please ensure GPS is enabled and try again.');
=======
                toast.error('Could not get location. Tap the map to pin manually.');
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
            },
            { timeout: 10000, maximumAge: 5000 },
        );
    };

<<<<<<< HEAD
    // const handleMapClick = ({ lng, lat }) => setCoords({ lng, lat }); // Disabled as per requirement
=======
    const handleMapClick = ({ lng, lat }) => setCoords({ lng, lat });
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!photo)   return toast.error('Please select a photo first.');
        if (!coords)  return toast.error('Please set your location.');

        const fd = new FormData();
        fd.append('photo', photo);
        fd.append('description', description.trim());
        fd.append('longitude', String(coords.lng));
        fd.append('latitude', String(coords.lat));

        setSubmitting(true);
        try {
<<<<<<< HEAD
            const res = await submitTicket(fd);
            const ticketId = res.data?.data?._id || res.data?.data?.id;
            // Start morph animation then redirect to track prompt
            setMorphState('morphing');
            setTimeout(() => setMorphState('success'), 650);
=======
            await submitTicket(fd);
            // Start morph animation
            setMorphState('morphing');
            setTimeout(() => setMorphState('success'), 650);
            // Reset after animation plays
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
            setTimeout(() => {
                setMorphState('idle');
                clearPhoto();
                setDescription('');
                setCoords(null);
<<<<<<< HEAD
                // Redirect to track prompt page with the new ticket ID
                if (ticketId) {
                    navigate(`/track?ticketId=${ticketId}`);
                }
            }, 2200);
=======
            }, 3200);
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
        } catch (err) {
            const msg =
                err.code === 'ECONNABORTED'
                    ? 'Upload is taking too long. Please retry on a stable connection.'
                    : (err.response?.data?.error ?? 'Submission failed. Check your connection and try again.');
            toast.error(msg);
            debugLog('submit:error', { status: err.response?.status, body: err.response?.data, msg: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const mapMarkers = coords
        ? [{ lng: coords.lng, lat: coords.lat, color: '#1337ec' }]
        : [];

    return (
        <div className="min-h-screen bg-[#f6f6f8] font-display text-slate-900 overflow-x-hidden">

            {/* ── Animated Blob Background ── */}
            <div className="blob blob-a" aria-hidden="true" />
            <div className="blob blob-b" aria-hidden="true" />
            <div className="blob blob-c" aria-hidden="true" />

            {/* ── Header ── */}
            <header className="relative z-40 w-full" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.35)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between">
                    {/* Brand — top left */}
                    <div className="flex items-center gap-2">
                        <div className="bg-primary text-white rounded-lg w-7 h-7 flex items-center justify-center shadow-md shadow-primary/30">
                            <span className="material-symbols-outlined text-[16px]">location_city</span>
                        </div>
                        <span className="text-base font-black tracking-tight text-slate-900">CivicLens</span>
                    </div>
<<<<<<< HEAD
                    {/* Action Links — top right */}
                    <div className="flex items-center gap-2">
                        {isUserAuthenticated && (
                            <Link
                                to="/dashboard"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                            >
                                <Icon name="dashboard" className="text-[18px]" />
                                Dashboard
                            </Link>
                        )}
                        <Link
                            to="/admin/login"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            <Icon name="shield_person" className="text-[18px]" />
                            Admin
                        </Link>
                    </div>
=======
                    {/* Admin — top right */}
                    <Link
                        to="/admin/login"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">shield_person</span>
                        Admin
                    </Link>
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                </div>
            </header>

            {/* ── Morph Success Overlay ── */}
            <div className={`morph-overlay${morphState !== 'idle' ? ' active' : ''}${morphState === 'success' ? ' show-check' : ''}`}>
                <div className="morph-backdrop" />
                <div className="flex flex-col items-center gap-5">
                    <div className="morph-circle">
                        <div className="morph-checkmark-wrap">
                            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                                <circle className="morph-checkmark-bg" cx="28" cy="28" r="28" fill="#22c55e" />
                                <path
                                    className="morph-checkmark-path"
                                    d="M16 28.5L24 36.5L40 20.5"
                                    stroke="white"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="morph-success-text text-center">
                        <p className="text-lg font-bold text-slate-800">Issue Reported!</p>
                        <p className="text-sm text-slate-500 mt-1">Thank you for helping your city.</p>
                    </div>
                </div>
            </div>

            {/* ── Form ── */}
            <main className={`relative z-10 px-4 pt-6 space-y-6 max-w-md mx-auto${morphState !== 'idle' ? ' form-morphing' : ''}`}>

                {/* Hero */}
                <section className="pt-4 pb-1 text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 mb-3">CivicLens · Smart Civic Reporting</p>
                    <h2 className="text-[28px] font-extrabold tracking-tight leading-tight text-slate-900">
                        Spotted<br />
                        <span key={heroIdx} className="text-primary animate-hero-fade">
                            {HERO_PHRASES[heroIdx]}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">Report it in 30 seconds. Make your city better.</p>
                </section>

                {/* Photo Upload */}
                <section className="bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm rounded-2xl p-4 space-y-3">
                    <label className="block text-sm font-semibold text-slate-600">
                        Visual Evidence
                    </label>

                    {preview ? (
                        <div className="relative rounded-xl overflow-hidden h-64">
                            <img
                                src={preview}
                                alt="Issue preview"
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={clearPhoto}
                                className="absolute top-3 right-3 bg-black/50 hover:bg-red-600 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors"
                                aria-label="Remove photo"
                            >
                                <Icon name="close" className="text-[20px]" />
                            </button>
                        </div>
                    ) : (
                        <label className="refractive-glass rounded-2xl h-64 flex flex-col items-center justify-center border-dashed border-2 border-primary/20 group cursor-pointer transition-all active:scale-[0.98]">
                            <div className="bg-primary text-white rounded-full p-4 shadow-lg shadow-primary/30 mb-4 group-hover:scale-110 transition-transform relative z-10">
                                <Icon name="photo_camera" className="text-4xl" />
                            </div>
                            <p className="text-primary font-semibold relative z-10">Tap to capture or upload</p>
                            <p className="text-xs text-slate-500 mt-1 relative z-10">High-quality photos help faster resolution</p>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                capture="environment"
                                className="hidden"
                                onChange={handleFile}
                            />
                        </label>
                    )}
                </section>

                {/* Description */}
                <section className="bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm rounded-2xl p-4 space-y-3">
                    <label className="block text-sm font-semibold text-slate-600">
                        Issue Description
                    </label>
                    <div className="glass rounded-2xl p-1 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Provide details about the issue (e.g., broken streetlight, pothole, illegal dumping)..."
                            maxLength={500}
                            className="w-full bg-transparent border-none outline-none focus:ring-0 text-slate-900 p-3 min-h-[140px] placeholder:text-slate-400 text-base resize-none"
                        />
                        <div className="flex items-center justify-between p-2">
                            <button
                                type="button"
                                onClick={toggleVoice}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                                    listening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'text-slate-500 hover:text-primary'
                                }`}
                                title={listening ? 'Stop listening' : 'Speak your description'}
                            >
                                <Icon name={listening ? 'mic_off' : 'mic'} className="text-[16px]" />
                                {listening ? 'Stop' : 'Voice Input'}
                            </button>
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                {description.length} / 500
                            </span>
                        </div>
                    </div>
                </section>

                {/* Location */}
                <section className="bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-600">
                            Incident Location
                        </label>
                        <button
                            type="button"
                            onClick={detectGPS}
                            disabled={locating}
                            className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider hover:underline disabled:opacity-60 transition-colors"
                        >
                            <Icon name="my_location" className="text-sm" />
                            {locating ? 'Detecting…' : 'Auto-detect GPS'}
                        </button>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden glass h-48 border border-slate-200">
                        <MapView
                            center={coords ? [coords.lng, coords.lat] : [78.9629, 20.5937]}
                            zoom={coords ? 14 : 4}
                            markers={mapMarkers}
<<<<<<< HEAD
                            onMapClick={null} // Explicitly disabled
=======
                            onMapClick={handleMapClick}
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                            interactive
                        />
                        {/* Location indicator overlay */}
                        {!coords && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative">
                                    <Icon name="location_on" className="text-primary text-4xl drop-shadow-md" />
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 blur-sm rounded-full" />
                                </div>
                            </div>
                        )}
                        {/* Address bar at bottom */}
                        <div className="absolute bottom-2 left-2 right-2">
                            <div className="glass px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2">
                                <Icon name="map" className="text-sm text-primary" />
                                <span className="truncate">
                                    {coords
<<<<<<< HEAD
                                        ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — 📍 [GPS FIXED]`
                                        : 'Auto-detect GPS to pin location'}
=======
                                        ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — tap map to reposition`
                                        : 'Tap the map or use GPS to pin location'}
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

            

                {/* Submit Button */}
                <section className="pt-4 pb-16">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !photo || !coords}
                        className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 text-base hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <span>{submitting ? 'Submitting…' : 'Submit Report'}</span>
                        <Icon name={submitting ? 'hourglass_empty' : 'send'} />
                    </button>
                    {(!photo || !coords) && (
                        <p className="text-center text-xs text-slate-400 mt-3">
<<<<<<< HEAD
                            {!photo && !coords ? 'Add a photo and detect your location to continue' : !photo ? 'Add a photo to continue' : 'Auto-detect your location to continue'}
=======
                            {!photo && !coords ? 'Add a photo and pin your location to continue' : !photo ? 'Add a photo to continue' : 'Pin your location to continue'}
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}

export default CitizenReportPage;

