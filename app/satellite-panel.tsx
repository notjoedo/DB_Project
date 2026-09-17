"use client";
import { useEffect, useState, useRef } from "react";
import { Satellite, ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";
export default function SatellitePanel({
  point,
  date,
  enabled,
  onSuggest,
}: {
  point: [number, number];
  date: string;
  enabled: boolean;
  onSuggest: () => void;
}) {
  const active = useRef<AbortController | null>(null);
  const [scenes, setScenes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current?.abort();
    setScenes(null);
    setError("");
    setLoading(false);
    return () => active.current?.abort();
  }, [point[0], point[1], date]);
  async function inspect() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    setScenes(null);
    try {
      const r = await fetch(
        `/api/satellite?lat=${point[0].toFixed(4)}&lng=${point[1].toFixed(4)}&date=${date}`,
        { signal: controller.signal },
      );
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setScenes(j.scenes);
    } catch (e: any) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <aside className="site-panel satellite-panel">
      <div className="panel-top">
        <span className="eyebrow">NATIONWIDE VEGETATION</span>
        <Satellite size={20} />
      </div>
      <h2>See where greenery grows.</h2>
      <p className="satellite-copy">
        Explore all 50 states, including Alaska and Hawaii. Pan and zoom to your
        neighborhood.
      </p>
      <div className="satellite-measurement">
        <span>Vegetation layer</span>
        <strong>{enabled ? "NDVI" : "Hidden"}</strong>
        <p>
          NASA MODIS Terra · 250 m pixels
          <br />
          Rolling 8-day observations ending {date || "…"}
        </p>
      </div>
      <img
        className="ndvi-official-legend"
        src="https://gibs.earthdata.nasa.gov/legends/MODIS_NDVI_H.svg"
        alt="NASA NDVI color scale from -0.2 to 1.0, with categories for missing data"
      />
      <p className="satellite-copy">
        Higher NDVI indicates greener vegetation, including grass and crops. Low
        NDVI may indicate buildings, roads, water, or bare ground. Blank areas
        have no usable measurement.
      </p>
      <div className="site-note">
        <Satellite size={18} />
        <p>
          This overview helps screen regions. It does not measure tree canopy or
          confirm planting availability. Zooming in does not increase its 250 m
          resolution.
        </p>
      </div>
      <a
        className="satellite-source"
        href={`https://worldview.earthdata.nasa.gov/?l=MODIS_Terra_NDVI_8Day&t=${date}`}
        target="_blank"
        rel="noreferrer"
      >
        View the NASA source <ArrowUpRight size={15} />
      </a>
      <h3 className="section-label">Explore finer satellite imagery</h3>
      <p className="satellite-copy">
        Find public 10 m Sentinel-2 scenes near the map center from the 60 days
        ending on the selected date. Scene cloud cover describes the whole
        satellite tile.
      </p>
      <p className="satellite-coordinates">
        {point[0].toFixed(3)}°, {point[1].toFixed(3)}°
      </p>
      <button
        className="outline-btn"
        onClick={inspect}
        disabled={loading || !date}
      >
        {loading ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <RefreshCw size={16} />
        )}{" "}
        {loading ? "Finding imagery…" : "Find 10 m imagery here"}
      </button>
      {error && (
        <p className="satellite-error" role="alert">
          {error}
        </p>
      )}
      {scenes && (
        <div className="satellite-scenes" aria-live="polite">
          {scenes.length === 0 ? (
            <p>No scenes found in this date range.</p>
          ) : (
            <>
              <p>
                Latest {scenes.length} scenes · raw imagery, NDVI not computed
              </p>
              {scenes.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                  <span>
                    {s.date.slice(0, 10)}
                    <small>
                      {Number.isFinite(s.cloudCover)
                        ? `${s.cloudCover.toFixed(1)}% scene cloud cover`
                        : "Cloud cover unavailable"}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </>
          )}
        </div>
      )}
      <button className="primary-btn satellite-suggest" onClick={onSuggest}>
        Suggest a site near the map center
      </button>
      <p className="satellite-copy">
        Local soil, space, utilities, native range, and planting permissions
        need to be checked before choosing a tree.
      </p>
    </aside>
  );
}
