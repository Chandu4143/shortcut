# Short Cut

**Take the shorter street.** Distance-first navigation for Hyderabad: the app plans the route with the least
distance through streets you can actually ride or walk, then shows what the conventional fastest route costs in
extra metres.

<p>
  <a href="https://github.com/Chandu4143/shortcut/releases/download/v1.0.0/ShortCut-1.0.0-arm64-v8a.apk">
    <img alt="Download the Android APK" src="https://img.shields.io/badge/Download-Android%20APK-E45537?style=for-the-badge&logo=android&logoColor=white">
  </a>
  <a href="https://chandu4143.github.io/shortcut/">
    <img alt="Open the download site" src="https://img.shields.io/badge/Site-shortcut-2B6968?style=for-the-badge">
  </a>
</p>

Tap the button and the APK downloads straight from this repository's releases. No store listing, no account.

## Download

| Build | Size | Use for |
|---|---:|---|
| [`ShortCut-1.0.0-arm64-v8a.apk`](https://github.com/Chandu4143/shortcut/releases/download/v1.0.0/ShortCut-1.0.0-arm64-v8a.apk) | 41.0 MB | Every Android phone from roughly 2017 onward. Start here. |
| [`ShortCut-1.0.0-armeabi-v7a.apk`](https://github.com/Chandu4143/shortcut/releases/download/v1.0.0/ShortCut-1.0.0-armeabi-v7a.apk) | 32.2 MB | Older 32-bit phones, if the arm64 build says “App not installed”. |
| [`ShortCut-1.0.0-x86_64.apk`](https://github.com/Chandu4143/shortcut/releases/download/v1.0.0/ShortCut-1.0.0-x86_64.apk) | 42.0 MB | Emulators and Intel test devices. |

Every asset lives on the [releases page](https://github.com/Chandu4143/shortcut/releases). Requires Android 7.0
(API 24) or newer and an internet connection for map tiles, place search and routing.

### Install

1. Tap the APK. GitHub serves the file and the browser downloads it.
2. Open the downloaded file and allow **Install unknown apps** for your browser or file manager when Android asks.
3. Launch **Short Cut** and allow location while using the app.

The build is signed with a project debug keystore, which is fine for sideloading but **not** Play Store ready. Each
asset's SHA-256 is in the release notes.

## What it does

- **Distance first.** Routes are ranked by metres over streets that permit your mode of travel; one-way tags and
  access restrictions are read from the map rather than assumed.
- **Shortest versus fastest, side by side.** The route card shows both distances, both times and the metres saved.
- **Live guidance.** GPS tracking, off-route rerouting, turn-by-turn details, spoken prompts and a preview drive.
- **Links from other apps.** Accepts `geo:`, `google.navigation:` and Google Maps links.
- **Ride and walk.** Motorcycle and pedestrian profiles, with a map style that keeps streets legible.

Routes come from [Valhalla](https://valhalla.github.io/valhalla/) with an OpenStreetMap
[Overpass](https://overpass-api.de/) fallback, place search from Nominatim, and tiles from OpenStreetMap raster and
OpenFreeMap sources. Public endpoints are best effort: a failed request shows a retry message instead of a wrong
line.

## Repository layout

| Path | What it is |
|---|---|
| `mobile/` | The Android app: Expo + React Native, MapLibre, Expo Router. |
| `src/` | A web prototype of the same distance-first planner (Vite + React + Leaflet). |
| `site/` | The download site published to GitHub Pages, with its design DNA in `site/design-dna.json`. |
| `scripts/release/` | Helper that creates the GitHub release and uploads the APKs. |

## Run it locally

Web prototype:

```sh
npm install
npm run dev
```

Download site (plain HTML, no build step):

```sh
npx http-server site
```

Android app:

```sh
cd mobile
npm install
npx expo start
```

Release APKs are produced from `mobile/` with the local Gradle build;
`scripts/release/publish-release.ps1` attaches whatever it finds in `mobile/dist` to the `v1.0.0` release.

## Data and attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open
Database License. Coverage and access tags vary by street; review a route before you take it. No live traffic is
used anywhere in the app.

## License

The mobile app is scaffolded from Expo's MIT-licensed template; see [`mobile/LICENSE`](mobile/LICENSE).
