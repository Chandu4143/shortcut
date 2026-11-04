## Take the shorter street

Short Cut plans the route with the **least distance** through streets you can actually ride or walk, then shows what the conventional fastest route costs you in extra metres.

Download the APK below and open it on your phone. No store, no account, no sign-in.

### Which file do I need?

| File | Size | Use for |
|---|---:|---|
| `ShortCut-1.0.0-arm64-v8a.apk` | 41.0 MB | **Almost every Android phone from 2017 onward** — start here |
| `ShortCut-1.0.0-armeabi-v7a.apk` | 32.2 MB | Older 32-bit phones, only if the arm64 build says "App not installed" |
| `ShortCut-1.0.0-x86_64.apk` | 42.0 MB | Emulators and Intel test devices — not for phones |

### Install

1. Tap the APK in your browser. GitHub downloads it straight away.
2. Open the downloaded file. If Android asks, allow **Install unknown apps** for your browser or file manager.
3. Launch **Short Cut** and allow location while using the app.
4. Keep an internet connection — map tiles, place search and routing are live services.

> Requires Android 7.0 (API 24) or newer. Built for Hyderabad; every route is drawn from OpenStreetMap streets.

### What works

- A faster, map-first planner with saved Home/Work, recent trips and a destination search that stays in Hyderabad.
- Distance-first motorcycle and walking routes via Valhalla, with a live OpenStreetMap/Overpass fallback.
- Shortest versus fastest comparison you can switch between, with the metres saved shown up front.
- Turn-by-turn details, route sharing, live navigation, GPS tracking, off-route rerouting, voice prompts, and a preview ride.
- Ride and Walk can be changed on the route sheet without losing the route.
- Accepts `geo:`, `google.navigation:`, and Google Maps links from other apps.

### Notes

- Signed with the project debug keystore: fine for direct sideloading, **not** Play Store ready.
- Public routing and geocoding endpoints are best-effort; a failed request shows a retry message.
- Map coverage and OSM access data vary. Review the route before you ride.
- This 1.0.0 asset was refreshed on 4 November 2026 with the redesigned UI; uninstall the older APK only if Android refuses to update it.

### SHA-256

```
E9FF81AEEE7E3687C39CD36154BA5B7D875D59D9787718D117C5850E8711ED22  ShortCut-1.0.0-arm64-v8a.apk
EB4704916B1A09F43D770FA70AB55A44FC34DA3BAB98CB59C187F968B19CD150  ShortCut-1.0.0-armeabi-v7a.apk
31BE9F946AD2EB48CE66E79B383563AB6C0D41E1C7E83A5B4CD168A3968AD7F0  ShortCut-1.0.0-x86_64.apk
```
