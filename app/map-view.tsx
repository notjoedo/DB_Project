"use client";
import { useEffect, useRef, useState } from "react";
import { Layers, LocateFixed, LoaderCircle, Plus, Minus } from "lucide-react";
import type { Site } from "@/lib/data";
import { nationalView, ndviTileUrl, type MapTarget } from "@/lib/national";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
export default function MapView({
  sites,
  selected,
  onSelect,
  onLocation,
  target,
  ndvi,
  date,
  opacity,
  focusSite,
  onMove,
}: {
  sites: Site[];
  selected: Site;
  onSelect: (s: Site) => void;
  onLocation: (lat: number, lng: number) => void;
  target: MapTarget;
  ndvi: boolean;
  date: string;
  opacity: number;
  focusSite: boolean;
  onMove: (lat: number, lng: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const leaflet = useRef<any>(null);
  const siteLayer = useRef<any>(null);
  const censusLayer = useRef<any>(null);
  const vegetationLayer = useRef<any>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const [vegetationFailed, setVegetationFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [census, setCensus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    let disposed = false;
    import("leaflet")
      .then((L) => {
        if (disposed || !host.current) return;
        leaflet.current = L;
        const m = L.map(host.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          minZoom: 2,
        }).setView([nationalView.lat, nationalView.lng], nationalView.zoom);
        m.on("moveend", () => {
          const c = m.getCenter();
          moveRef.current(c.lat, ((((c.lng + 180) % 360) + 360) % 360) - 180);
        });
        map.current = m;
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(m);
        tiles.on("tileerror", () => setFailed(true));
        siteLayer.current = L.layerGroup().addTo(m);
        censusLayer.current = L.layerGroup().addTo(m);
        L.control.scale({ position: "bottomright", imperial: false }).addTo(m);
        const observer = new ResizeObserver(() => {
          if (map.current === m) m.invalidateSize();
        });
        observerRef.current = observer;
        observer.observe(host.current);
        setReady(true);
        return observer;
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      observerRef.current?.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const L = leaflet.current;
    siteLayer.current.clearLayers();
    sites.forEach((s) => {
      const color =
        s.priority === "High"
          ? "#cf885a"
          : s.priority === "Medium"
            ? "#baa057"
            : "#6d995c";
      L.circle([s.lat, s.lng], {
        radius: s.example ? 430 : 90,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: s.id === selected.id ? 0.18 : 0.1,
        dashArray: "4 5",
      }).addTo(siteLayer.current);
      const marker = L.marker([s.lat, s.lng], {
        title: s.name,
        alt: s.name,
        icon: L.divIcon({
          className: "site-marker-wrapper",
          html: `<span class="site-marker ${s.id === selected.id ? "active" : ""}" style="--pin-color:${color}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 3-7 9h4l-5 6h7v3h2v-3h7l-5-6h4z"/></svg></span>`,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        }),
      });
      const text = document.createElement("span");
      text.textContent = s.name;
      marker.getElement()?.setAttribute("aria-label", s.name);
      marker
        .bindTooltip(text, { direction: "top", offset: [0, -35] })
        .on("click", () => selectRef.current(s))
        .addTo(siteLayer.current);
    });
  }, [ready, sites, selected]);
  useEffect(() => {
    if (map.current && ready && focusSite)
      map.current.flyTo([selected.lat, selected.lng], 13, { duration: 0.5 });
  }, [selected.id, ready, focusSite]);
  useEffect(() => {
    if (map.current && ready && !focusSite)
      map.current.flyTo([target.lat, target.lng], target.zoom, {
        duration: 0.5,
      });
  }, [target, ready, focusSite]);
  useEffect(() => {
    if (!ready) return;
    vegetationLayer.current?.remove();
    vegetationLayer.current = null;
    setVegetationFailed(false);
    if (!ndvi || !date) return;
    const layer = leaflet.current
      .tileLayer(ndviTileUrl(date), {
        maxNativeZoom: 9,
        maxZoom: 19,
        minZoom: 2,
        opacity,
        attribution:
          '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> · MODIS Terra NDVI · 250 m',
      })
      .addTo(map.current);
    vegetationLayer.current = layer;
    layer.on("tileerror", () => setVegetationFailed(true));
    return () => {
      layer.remove();
    };
  }, [ready, ndvi, date]);
  useEffect(() => {
    vegetationLayer.current?.setOpacity(opacity);
  }, [opacity]);
  useEffect(() => {
    if (!ready) return;
    censusLayer.current.clearLayers();
    setSummary(null);
    setLoading(false);
    if (
      !census ||
      !focusSite ||
      selected.lat < 40.45 ||
      selected.lat > 40.95 ||
      selected.lng < -74.3 ||
      selected.lng > -73.65
    )
      return;
    let stopped = false;
    const abort = new AbortController();
    setLoading(true);
    setSummary(null);
    fetch(`/api/geo?lat=${selected.lat}&lng=${selected.lng}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        const j: any = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (stopped) return;
        const L = leaflet.current;
        j.trees.forEach((t: any) => {
          if (!t.latitude || !t.longitude) return;
          const text = document.createElement("div");
          text.textContent = `${t.spc_common ?? t.status ?? "Street tree"} · ${t.health ?? "Unknown health"} · 2015 census`;
          L.circleMarker([Number(t.latitude), Number(t.longitude)], {
            radius: 3,
            color: "#316a49",
            weight: 1,
            fillOpacity: 0.75,
          })
            .bindTooltip(text)
            .addTo(censusLayer.current);
        });
        setCount(j.trees.length);
        setSummary(j.summary);
      })
      .catch((e) => {
        if (e.name !== "AbortError") toast.error(e.message);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
      abort.abort();
    };
  }, [census, selected.id, ready, focusSite]);
  function locate() {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.current?.flyTo([latitude, longitude], 13);
        onLocation(latitude, longitude);
        toast.success("Showing sites closest to you.");
      },
      () =>
        toast.error(
          "Location access was unavailable. You can search by neighborhood instead.",
        ),
    );
  }
  return (
    <div className="map-surface">
      <div
        ref={host}
        className="leaflet-host"
        aria-label="Interactive map of tree planting areas"
      />
      {!ready && (
        <div className="map-loading">
          <LoaderCircle className="animate-spin" />
          Loading United States map
        </div>
      )}
      <div className="map-chip">
        <Layers size={16} />{" "}
        {ndvi ? "Vegetation · 250 m NDVI" : "Community planting sites"}
      </div>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={18} />
        </button>
        <button aria-label="Use my location" onClick={locate}>
          <LocateFixed size={18} />
        </button>
      </div>
      {focusSite &&
        selected.lat > 40.45 &&
        selected.lat < 40.95 &&
        selected.lng > -74.3 &&
        selected.lng < -73.65 && (
          <label className="census-toggle">
            <Switch
              checked={census}
              onCheckedChange={setCensus}
              aria-label="Show NYC street tree census"
            />
            <span>
              NYC street trees{" "}
              <small>
                2015 census
                {census
                  ? loading
                    ? " · loading"
                    : ` · ${count}${count === 500 ? "+" : ""} records`
                  : ""}
              </small>
            </span>
          </label>
        )}
      <div className="map-legend">
        <strong>Reported site priority</strong>
        <span>
          <i className="high" />
          High
        </span>
        <span>
          <i className="medium" />
          Medium
        </span>
        <span>
          <i className="low" />
          Low
        </span>
      </div>
      {census && focusSite && summary && !loading && (
        <div className="geo-summary">
          <strong>
            {summary.capped ? "At least " : ""}
            {summary.alive} trees within 250 m
          </strong>
          <span>{summary.deadOrStump} dead trees / stumps recorded</span>
          <small>Historical census · not current planting availability</small>
        </div>
      )}
      {vegetationFailed && (
        <div className="map-error">
          Some vegetation tiles are unavailable for this date. Missing imagery
          does not mean low vegetation.
        </div>
      )}
      {failed && (
        <div className="map-error">
          Some map tiles could not load. The site list is still available.
        </div>
      )}
    </div>
  );
}
