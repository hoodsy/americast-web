import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Aliased: the default export is named `Map`, which would shadow the global.
import MapGL, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import californiaOutline from '../assets/california.json';
import californiaCounties from '../assets/california-counties.json';
import usStates from '../assets/us-states.json';
import type { Plant, PlantSeries } from '../api/types';
import {
  DIM_EDGE,
  DIM_LAND,
  GRID,
  LAND,
  LAND_EDGE,
  MUTED,
  UNLIT,
  rampExpression,
  type Mode,
} from '../lib/clearness';
import { CITIES } from '../lib/cities';
import { plantRadius } from '../lib/plants';
import { sampleClearness } from '../lib/series';
import { formatPacific } from '../lib/time';
import { Legend } from './Legend';
import './PlantMap.css';

/** Below this, only tier-1 cities are labelled — the rest would collide. */
const TIER_2_MIN_ZOOM = 6;

/**
 * No tiles, no basemap, no glyphs — the canvas stays transparent and the
 * container's own surface colour shows through, so theming stays in CSS.
 *
 * Built fresh per map rather than shared from module scope: MapLibre mutates
 * the style object it is handed as sources and layers are added, so a shared
 * literal comes back poisoned with the previous map's entries on any remount,
 * and the style then never finishes loading.
 */
function emptyStyle() {
  return { version: 8 as const, sources: {}, layers: [] };
}

const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
  [-124.55, 32.45],
  [-114.05, 42.05],
];

interface HoverState {
  plant: Plant;
  x: number;
  y: number;
}

interface Props {
  plants: Plant[];
  series: Map<number, PlantSeries>;
  validTimes: string[];
  /** Fractional hour — what the circles are painted from, so they dissolve. */
  pos: number;
  /** The hour the reader is on. The tooltip quotes this one exactly. */
  cursor: number;
  mode: Mode;
}

export function PlantMap({ plants, series, validTimes, pos, cursor, mode }: Props) {
  /**
   * The map instance is captured from its own events rather than read off a
   * ref. react-map-gl does not reliably populate the ref here, and a null ref
   * silently costs us every feature-state write — all 788 plants then paint as
   * invisible unlit specks while `queryRenderedFeatures` still reports 788.
   */
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [zoom, setZoom] = useState(5);
  const hoveredId = useRef<number | null>(null);
  const didFit = useRef(false);
  const [style] = useState(emptyStyle);

  /**
   * Fitted here rather than through initialViewState's `bounds`, which
   * react-map-gl does not apply — the camera silently stays at the default
   * centre and the state never enters the viewport.
   *
   * Deferred out of the event that triggers it. Moving the camera synchronously
   * from inside MapLibre's own `sourcedata`/`idle` dispatch re-enters the style
   * while it is still wiring sources up, and the style then never finishes
   * loading: no layers are ever added and `load` never fires.
   */
  const fitOnce = useCallback((map: MapLibreMap) => {
    if (didFit.current) return;
    didFit.current = true;
    requestAnimationFrame(() => {
      map.fitBounds(CALIFORNIA_BOUNDS, { padding: 24, duration: 0 });
      setZoom(map.getZoom());
    });
  }, []);

  const cities = useMemo(
    () => CITIES.filter((c) => c.tier === 1 || zoom >= TIER_2_MIN_ZOOM),
    [zoom],
  );

  const plantsById = useMemo(() => {
    const m = new Map<number, Plant>();
    for (const p of plants) m.set(p.plant_id, p);
    return m;
  }, [plants]);

  /** Built once. Geometry never changes; only feature state does. */
  const collection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: plants.map((p) => ({
        type: 'Feature' as const,
        id: p.plant_id,
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
        properties: {
          plant_id: p.plant_id,
          r: plantRadius(p.capacity_mw_ac),
          // Smaller plants get a higher sort key, so the big ones are drawn
          // first and the specks land on top and stay hoverable.
          sort: -p.capacity_mw_ac,
        },
      })),
    }),
    [plants],
  );

  /**
   * Repaint on scrub, and on every frame of the hour's transition. This walks
   * feature state rather than rebuilding the source, so the 788 circles are
   * never torn down and re-created — the alternative at 60fps is unaffordable.
   *
   * It waits for the source itself rather than for any lifecycle event. The
   * map's `load` does not always arrive, and `sourcedata` can fire just before
   * the source finishes parsing, leaving nothing to re-trigger the paint — so
   * this retries per frame until the write can actually land.
   */
  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const paint = () => {
      if (cancelled) return;
      if (!map.getSource('plants') || !map.isSourceLoaded('plants')) {
        requestAnimationFrame(paint);
        return;
      }
      for (const p of plants) {
        const s = series.get(p.plant_id);
        // A plant with no sun is unlit, not zero — the fill is switched off
        // rather than painted at the bottom of the ramp. `lit` carries that as
        // a fraction so first light is a fade, not a snap.
        const state = s ? sampleClearness(s.clearness, pos) : { clearness: 0, lit: 0 };
        map.setFeatureState({ source: 'plants', id: p.plant_id }, state);
      }
    };

    paint();
    return () => {
      cancelled = true;
    };
  }, [map, plants, series, pos]);

  const outlineFill = useMemo<FillLayerSpecification['paint']>(
    () => ({ 'fill-color': LAND[mode] }),
    [mode],
  );

  const outlineLine = useMemo<LineLayerSpecification['paint']>(
    () => ({ 'line-color': LAND_EDGE[mode], 'line-width': 1.2 }),
    [mode],
  );

  /** The rest of the country: present for orientation, and no louder. */
  const dimFill = useMemo<FillLayerSpecification['paint']>(
    () => ({ 'fill-color': DIM_LAND[mode] }),
    [mode],
  );

  const dimLine = useMemo<LineLayerSpecification['paint']>(
    () => ({
      'line-color': DIM_EDGE[mode],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 1.1],
    }),
    [mode],
  );

  /** Counties sit under the plants and stay quieter than the state edge —
   *  they are orientation, not data. */
  const countyLine = useMemo<LineLayerSpecification['paint']>(
    () => ({
      'line-color': GRID[mode],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 1],
      'line-opacity': mode === 'light' ? 0.9 : 0.7,
    }),
    [mode],
  );

  const circlePaint = useMemo<CircleLayerSpecification['paint']>(
    () => ({
      'circle-radius': ['get', 'r'],
      'circle-color': rampExpression(mode) as never,
      'circle-opacity': ['number', ['feature-state', 'lit'], 0],
      // Every point gets a hairline in the land colour so overlapping plants
      // stay separable; unlit ones show that hairline in neutral instead, as
      // an empty outline. Across first light the two cross-fade, which is what
      // turns the outline into a filled dot rather than swapping it.
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2,
        ['interpolate', ['linear'], ['get', 'r'], 1.5, 0.5, 6, 1],
      ],
      'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        MUTED,
        [
          'interpolate',
          ['linear'],
          ['number', ['feature-state', 'lit'], 0],
          0,
          UNLIT[mode],
          1,
          LAND[mode],
        ],
      ],
    }),
    [mode],
  );

  const setHovered = useCallback(
    (id: number | null) => {
      if (!map) return;

      if (hoveredId.current !== null) {
        map.setFeatureState({ source: 'plants', id: hoveredId.current }, { hover: false });
      }
      if (id !== null) {
        map.setFeatureState({ source: 'plants', id }, { hover: true });
      }
      hoveredId.current = id;
    },
    [map],
  );

  const onMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.plant_id as number | undefined;
      const plant = id === undefined ? undefined : plantsById.get(id);

      if (!plant) {
        setHovered(null);
        setHover(null);
        return;
      }

      setHovered(plant.plant_id);
      setHover({ plant, x: e.point.x, y: e.point.y });
    },
    [plantsById, setHovered],
  );

  const onLeave = useCallback(() => {
    setHovered(null);
    setHover(null);
  }, [setHovered]);

  const tooltip = hover && buildTooltip(hover.plant, series.get(hover.plant.plant_id), cursor, validTimes);

  return (
    <div className="map">
      <div className="map__canvas">
      <div className="map__fill">
      <MapGL
        initialViewState={{ longitude: -119.4, latitude: 37.2, zoom: 5 }}
        mapStyle={style}
        attributionControl={false}
        dragRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactiveLayerIds={['plants']}
        onLoad={(e) => {
          setMap(e.target);
          fitOnce(e.target);
        }}
        onSourceData={(e) => setMap(e.target)}
        onIdle={(e) => {
          setMap(e.target);
          fitOnce(e.target);
        }}
        onZoom={(e) => setZoom(e.target.getZoom())}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onMove}
        cursor="default"
      >
        {/* The rest of the country, under everything: it sets California in
            place without ever competing with it. */}
        <Source id="us" type="geojson" data={usStates as never}>
          <Layer id="us-fill" type="fill" paint={dimFill} />
          <Layer id="us-line" type="line" paint={dimLine} />
        </Source>

        <Source id="outline" type="geojson" data={californiaOutline as never}>
          <Layer id="outline-fill" type="fill" paint={outlineFill} />
        </Source>

        <Source id="counties" type="geojson" data={californiaCounties as never}>
          <Layer id="county-line" type="line" paint={countyLine} />
        </Source>

        <Source id="outline-edge" type="geojson" data={californiaOutline as never}>
          <Layer id="outline-line" type="line" paint={outlineLine} />
        </Source>

        {cities.map((c) => (
          <Marker key={c.name} longitude={c.longitude} latitude={c.latitude} anchor="center">
            {/* Labels only, no marks — these orient the reader; they are not data. */}
            <span className={`city city--t${c.tier}`}>{c.name}</span>
          </Marker>
        ))}

        <Source id="plants" type="geojson" data={collection}>
          <Layer id="plants" type="circle" paint={circlePaint} layout={{ 'circle-sort-key': ['get', 'sort'] }} />
        </Source>
      </MapGL>
      </div>

      {tooltip && (
        <div
          className="map__tooltip"
          style={{
            left: hover.x,
            top: hover.y,
            // Flip the card back across the cursor near the right/bottom edge.
            transform: `translate(${hover.x > 240 ? '-100%' : '0'}, ${hover.y > 160 ? '-100%' : '0'}) translate(${hover.x > 240 ? -12 : 12}px, ${hover.y > 160 ? -12 : 12}px)`,
          }}
          role="status"
        >
          <div className="map__tooltip-name">{tooltip.name}</div>
          <div className="map__tooltip-meta muted">{tooltip.meta}</div>
          <div className="map__tooltip-value tabular">{tooltip.value}</div>
          {tooltip.clear && (
            <div className="map__tooltip-meta muted tabular">{tooltip.clear}</div>
          )}
          <div className="map__tooltip-meta muted tabular">{tooltip.when}</div>
        </div>
      )}
      </div>

      <Legend mode={mode} />
    </div>
  );
}

function buildTooltip(
  plant: Plant,
  s: PlantSeries | undefined,
  cursor: number,
  validTimes: string[],
) {
  const mw = s?.mw[cursor] ?? 0;
  const clearness = s?.clearness[cursor] ?? null;
  const cap = plant.capacity_mw_ac;

  return {
    name: plant.name,
    // Capacity moved into the output line, where it is the denominator.
    meta: `${plant.county} County`,
    value:
      clearness === null
        ? 'Not generating — no meaningful sun'
        : `${mw.toFixed(1)} MW / ${cap.toFixed(1)} MW capacity`,
    // Not a second way of saying the line above. That one is output against
    // nameplate, which folds in the time of day; this is output against what
    // a cloudless sky would give *at this hour*, which is weather alone — a
    // plant at dusk can sit at 100% of clear sky and 10% of nameplate. It is
    // also the number the circle's colour encodes, and reaching it as text is
    // what makes the low end of the ramp acceptable at its contrast.
    clear: clearness === null ? '' : `${(clearness * 100).toFixed(0)}% of clear-sky output`,
    when: validTimes[cursor] ? formatPacific(validTimes[cursor]) : '',
  };
}
