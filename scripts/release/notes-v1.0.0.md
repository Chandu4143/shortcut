## Take the shorter street

Short Cut plans the route with the **least distance** through streets you can actually ride or walk, then shows what the conventional fastest route costs you in extra metres.

Download the APK below and open it on your phone. No store, no account, no sign-in.

### Which file do I need?

| File | Size | Use for |
|---|---:|---|
| `ShortCut-1.0.0-arm64-v8a.apk` | 40.8 MB | **Almost every Android phone from 2017 onward** — start here |
| `ShortCut-1.0.0-armeabi-v7a.apk` | 32.1 MB | Older 32-bit phones, only if the arm64 build says "App not installed" |
| `ShortCut-1.0.0-x86_64.apk` | 41.9 MB | Emulators and Intel test devices — not for phones |

### Install

1. Tap the APK in your browser. GitHub downloads it straight away.
2. Open the downloaded file. If Android asks, allow **Install unknown apps** for your browser or file manager.
3. Launch **Short Cut** and allow location while using the app.
4. Keep an internet connection — map tiles, place search and routing are live services.

> Requires Android 7.0 (API 24) or newer. Built for Hyderabad; every route is drawn from OpenStreetMap streets.

### What works

- Hyderabad map, GPS origin, place search, and map pin selection.
- Distance-first motorcycle and walking routes via Valhalla, with a live OpenStreetMap/Overpass fallback.
- Shortest versus fastest comparison, distance saved, turn-by-turn details, and route sharing.
- Live navigation, GPS tracking, off-route rerouting, voice prompts, and a preview drive simulation.
- Accepts `geo:`, `google.navigation:`, and Google Maps links from other apps.

### Notes

- Signed with the project debug keystore: fine for direct sideloading, **not** Play Store ready.
- Public routing and geocoding endpoints are best-effort; a failed request shows a retry message.
- Map coverage and OSM access data vary. Review the route before you ride.

### SHA-256

```
E7A4619AB8CFB682F4251F4B1F4FC1EC76B320183B112ACC5B1C4F54BA8A38EE  ShortCut-1.0.0-arm64-v8a.apk
880A6136AD24F4A1C1B708307E573BE887AF77C3B433A4B8BF0D3257459DE478  ShortCut-1.0.0-armeabi-v7a.apk
42F3A244025392BDDC7FB117BF26001A124B78E44D3FC0CFBF0B7D577B207221  ShortCut-1.0.0-x86_64.apk
```
