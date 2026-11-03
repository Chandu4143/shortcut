# Short Cut MVP

A responsive, map-first prototype for distance-first routing in Hyderabad. It requests a distance-weighted shortest route and a fastest-route comparison from Valhalla, then falls back to a small locally calculated OpenStreetMap street graph if the route API is unavailable. The shortest route is the default and visually emphasized.

## Run locally

```sh
npm install
npm run dev
```

Open the local Vite URL in a browser. Use **Pick start on map**, **Pick destination**, address search, or the location button to set the endpoints. Location access requires HTTPS or localhost.

## MVP scope

- Riding and walking route profiles.
- Valhalla distance-first routing with mode-aware access restrictions.
- Overpass fallback using a local street graph filtered by mapped access and direction restrictions.
- Shortest-distance route, estimated time, and a fastest-by-road-type comparison.
- Map pin selection, place search, current location, and responsive layout.

The fastest option uses the routing engine's estimated travel times. Neither route includes live traffic or guarantees map completeness. OSM tags can be missing or wrong; review the route before travelling.

## Data services

The prototype uses the public FOSSGIS Valhalla demo server for primary routing, public OpenStreetMap Overpass instances for fallback street data, Nominatim for place search, and standard OpenStreetMap raster tiles. Requests identify the app with `X-Client-Id: short-cut-mvp.local`. Public endpoints are subject to fair-use limits and best-effort availability; they are suitable for a prototype, not an unmetered commercial service. A production release should use a hosted or self-managed routing/data provider, an approved geocoder and tile plan, and a backend that identifies and rate-limits requests.

OpenStreetMap data is licensed under the Open Database License. Attribution is shown on the map and in the route panel.
