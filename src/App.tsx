import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowUpRight,
  Bike,
  Check,
  CircleHelp,
  Crosshair,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  Signal,
  X,
} from 'lucide-react';
import MapCanvas from './components/MapCanvas';
import { findRoutes, searchPlaces } from './lib/routing';
import type { Place, RoutePair, TravelMode } from './lib/routing';

type PickMode = 'origin' | 'destination' | null;

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function shortLabel(label: string) {
  return label.split(',').slice(0, 2).join(',');
}

function PlaceSearch({
  value,
  placeholder,
  icon,
  active,
  onFocus,
  onSelect,
  onInvalidate,
}: {
  value: Place | null;
  placeholder: string;
  icon: 'start' | 'end';
  active: boolean;
  onFocus: () => void;
  onSelect: (place: Place) => void;
  onInvalidate: () => void;
}) {
  const [query, setQuery] = useState(value ? shortLabel(value.label) : '');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const keepTypedText = useRef(false);

  useEffect(() => {
    if (keepTypedText.current) {
      keepTypedText.current = false;
      return;
    }
    setQuery(value ? shortLabel(value.label) : '');
  }, [value]);

  useEffect(() => {
    if (!active || query.trim().length < 3 || (value && query === shortLabel(value.label))) {
      setResults([]);
      setSearching(false);
      setError('');
      return;
    }
    const abortController = new AbortController();
    controller.current?.abort();
    controller.current = abortController;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const matches = await searchPlaces(query.trim(), abortController.signal);
        setResults(matches);
        setOpen(true);
      } catch (caught) {
        if (!abortController.signal.aborted) {
          setResults([]);
          setError(caught instanceof Error ? caught.message : 'Search could not be completed.');
        }
      } finally {
        if (!abortController.signal.aborted) setSearching(false);
      }
    }, 1000);
    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [active, query, value]);

  const select = (place: Place) => {
    keepTypedText.current = false;
    onSelect(place);
    setQuery(shortLabel(place.label));
    setResults([]);
    setOpen(false);
    setError('');
  };

  return (
    <div className={`place-search ${active ? 'is-active' : ''}`}>
      <span className={`place-symbol ${icon === 'start' ? 'place-symbol-start' : 'place-symbol-end'}`} aria-hidden="true">
        {icon === 'start' ? <span /> : <MapPin size={15} strokeWidth={2.5} />}
      </span>
      <input
        value={query}
        placeholder={placeholder}
        aria-label={icon === 'start' ? 'Starting point' : 'Destination'}
        onFocus={() => { onFocus(); setOpen(true); }}
        onChange={(event) => {
          keepTypedText.current = Boolean(value);
          onInvalidate();
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && results[0]) select(results[0]);
        }}
      />
      {searching && <span className="search-loader" aria-label="Searching" />}
      {query && !searching && (
        <button className="input-clear" type="button" aria-label="Clear location" onClick={() => {
          keepTypedText.current = Boolean(value);
          onInvalidate();
          setQuery('');
          setResults([]);
          setOpen(false);
        }}>
          <X size={15} />
        </button>
      )}
      {open && (results.length > 0 || error) && (
        <div className="suggestions" role="listbox">
          {results.map((place) => (
            <button key={`${place.lat}-${place.lon}`} type="button" role="option" className="suggestion" onMouseDown={(event) => event.preventDefault()} onClick={() => select(place)}>
              <span className="suggestion-pin"><MapPin size={15} /></span>
              <span><strong>{shortLabel(place.label)}</strong><small>{place.label}</small></span>
            </button>
          ))}
          {error && <p className="suggestion-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('riding');
  const [routes, setRoutes] = useState<RoutePair | null>(null);
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setRoutes(null);
    setStatus('idle');
    setMessage('');
  }, [travelMode, origin, destination]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('This browser does not support location. Search for a start point instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'My location',
        });
        setActiveField('destination');
        setPickMode(null);
        setLocating(false);
        setMessage('');
        setStatus('idle');
      },
      () => {
        setLocating(false);
        setStatus('error');
        setMessage('Location was unavailable. Allow location access or search for a start point.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  };

  const calculate = async () => {
    if (!origin || !destination) {
      setStatus('error');
      setMessage('Add a starting point and destination to find the shortest route.');
      return;
    }
    setPickMode(null);
    setStatus('loading');
    setMessage('Loading mapped streets and comparing routes…');
    try {
      const routePair = await findRoutes(origin, destination, travelMode);
      setRoutes(routePair);
      setStatus('ready');
      setMessage('Shortest route found from mapped streets.');
    } catch (caught) {
      setRoutes(null);
      setStatus('error');
      setMessage(caught instanceof Error ? caught.message : 'Route calculation failed. Try again.');
    }
  };

  const setMapPoint = (point: Place) => {
    if (pickMode === 'origin') {
      setOrigin(point);
      setActiveField('destination');
    } else if (pickMode === 'destination') {
      setDestination(point);
    }
    setPickMode(null);
  };

  const beginMapPick = (field: 'origin' | 'destination') => {
    setActiveField(field);
    setPickMode(field);
  };

  const shortest = routes?.shortest;
  const saving = routes && routes.fastest.distanceMeters - routes.shortest.distanceMeters;
  const hasSaving = typeof saving === 'number' && saving > 30;

  return (
    <main className="app-shell">
      <MapCanvas
        origin={origin}
        destination={destination}
        routes={routes}
        pickMode={pickMode}
        onMapPick={setMapPoint}
      />

      <aside className="route-panel" aria-label="Route planner">
        <header className="brand-row">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-name">short<span>cut</span></span>
          </div>
          <div className="coverage-chip"><span /> Hyderabad pilot</div>
        </header>

        <section className="intro-copy">
          <p className="intro-kicker"><Signal size={14} /> DISTANCE-FIRST NAVIGATION</p>
          <h1>Take the<br /><em>shorter street.</em></h1>
          <p className="intro-subtitle">Find the shortest route through streets you can actually use.</p>
        </section>

        <section className="route-form" aria-label="Choose your route">
          <div className="location-fields">
            <div className="location-rail" aria-hidden="true"><span /><i /><span /></div>
            <div className="field-stack">
              <div className="field-row">
                <PlaceSearch
                  value={origin}
                  placeholder="Starting point"
                  icon="start"
                  active={activeField === 'origin'}
                  onFocus={() => { setActiveField('origin'); setPickMode(null); }}
                  onSelect={(place) => { setOrigin(place); setActiveField('destination'); }}
                  onInvalidate={() => setOrigin(null)}
                />
                <button className={`inline-tool ${locating ? 'is-spinning' : ''}`} type="button" aria-label="Use my current location" title="Use my current location" onClick={locateMe} disabled={locating}>
                  <LocateFixed size={17} />
                </button>
              </div>
              <div className="field-row">
                <PlaceSearch
                  value={destination}
                  placeholder="Where to?"
                  icon="end"
                  active={activeField === 'destination'}
                  onFocus={() => { setActiveField('destination'); setPickMode(null); }}
                  onSelect={(place) => setDestination(place)}
                  onInvalidate={() => setDestination(null)}
                />
                <button className="inline-tool" type="button" aria-label="Swap start and destination" title="Swap start and destination" onClick={() => { setOrigin(destination); setDestination(origin); setRoutes(null); }}>
                  <ArrowDownUp size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="map-pick-row">
            <button type="button" className={pickMode === 'origin' ? 'pick-active' : ''} onClick={() => beginMapPick('origin')}>
              <Crosshair size={14} /> Pick start on map
            </button>
            <button type="button" className={pickMode === 'destination' ? 'pick-active' : ''} onClick={() => beginMapPick('destination')}>
              <MapPin size={14} /> Pick destination
            </button>
          </div>

          <div className="mode-row">
            <span className="mode-label">TRAVEL MODE</span>
            <div className="mode-switch" role="group" aria-label="Travel mode">
              <button className={travelMode === 'riding' ? 'selected' : ''} type="button" onClick={() => setTravelMode('riding')} aria-pressed={travelMode === 'riding'}>
                <Bike size={16} /> Riding
              </button>
              <button className={travelMode === 'walking' ? 'selected' : ''} type="button" onClick={() => setTravelMode('walking')} aria-pressed={travelMode === 'walking'}>
                <Footprints size={16} /> Walking
              </button>
            </div>
          </div>

          <button className="route-button" type="button" onClick={calculate} disabled={status === 'loading'}>
            {status === 'loading' ? <span className="button-loader" /> : <Navigation size={17} fill="currentColor" />}
            {status === 'loading' ? 'Finding the shortest route' : 'Find shortest route'}
            {status !== 'loading' && <ArrowUpRight size={17} className="button-arrow" />}
          </button>
          <div className={`form-message ${status === 'error' ? 'message-error' : ''} ${status === 'ready' ? 'message-ready' : ''}`} aria-live="polite">
            {status === 'ready' ? <Check size={13} /> : status === 'error' ? <CircleHelp size={14} /> : <span className="message-spacer" />}
            <span>{message || 'Routes follow mapped access and direction restrictions.'}</span>
          </div>
        </section>

        {shortest && routes && (
          <section className="route-result" aria-label="Route results">
            <div className="result-heading">
              <span className="result-icon"><Navigation size={14} fill="currentColor" /></span>
              <div><strong>Shortest route</strong><small>Ranked by total distance</small></div>
              <span className="result-badge">SHORTEST</span>
            </div>
            <div className="result-primary">
              <strong>{formatDistance(shortest.distanceMeters)}</strong>
              <span>about {formatDuration(shortest.durationSeconds)}</span>
            </div>
            {hasSaving && (
              <div className="saving-note"><span>{formatDistance(saving!)}</span> less distance than the fastest route</div>
            )}
            <div className="alternate-route">
              <span className="alternate-line" />
            <div><strong>Fastest option</strong><small>Estimated by the route engine</small></div>
              <div className="alternate-metrics"><strong>{formatDistance(routes.fastest.distanceMeters)}</strong><small>{formatDuration(routes.fastest.durationSeconds)}</small></div>
            </div>
            <div className="result-footer">
              <span><span className="route-key route-key-short" /> Shortest</span>
              <span><span className="route-key route-key-fast" /> Fastest</span>
              <button type="button" onClick={() => { setRoutes(null); setStatus('idle'); setMessage(''); }} aria-label="Clear route"><X size={15} /> Clear</button>
            </div>
          </section>
        )}

        <footer className="panel-footnote">
          <span><span className="footnote-dot" /> Mapped roads · No live traffic</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Data & attribution</a>
        </footer>
      </aside>

      {pickMode && <div className="map-pick-hint"><MapPin size={16} /> Tap the map to set {pickMode === 'origin' ? 'your start' : 'your destination'} <button type="button" onClick={() => setPickMode(null)} aria-label="Cancel map selection"><X size={15} /></button></div>}
      {!pickMode && <div className="map-mode-note"><span className="map-scale-mark" /> Shortest mapped path</div>}
    </main>
  );
}
