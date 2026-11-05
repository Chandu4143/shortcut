# Short Cut — launch reel (9:16)

`shortcut-reel-9x16.mp4` — 1080×1920, 18.4s, 30fps, H.264, silent, 2.9 MB.
`shortcut-reel-9x16-poster.png` — first-frame poster / thumbnail (use it if a platform lets you pick a cover).

The reel is built from the real app screens (`app-home`, `app-route`), the site's
palette and type, and three claims that are actually true of the 1.0.0 build:

1. Routes are ranked by metres, not minutes.
2. The same trip is 4.7 km instead of 4.9 km — 200 m shorter than the fastest route (the numbers in the screenshots).
3. Free APK, no account, no ads, no background location.

It never claims live traffic, turn-by-turn voice quality, or a Play Store release.

---

## X

> Every navigation app optimises for time. Short Cut optimises for metres.
>
> Hyderabad · ride or walk · 4.7 km instead of 4.9 — on streets you're actually allowed through.
>
> Free APK, no account, no ads. Built solo, still rough at the edges.
>
> chandu4143.github.io/shortcut

**Reply 1 (put the link here, not in the main post — link posts travel worse):**

> It's a sideload build, not a store release: debug-signed APK, manual updates, no live traffic. What it does have is a distance-first router that reads one-way and access tags instead of assuming them.
>
> Feedback very welcome, especially "this street is wrong".

**Alt text:** Vertical video. Paper-white title "Take the shorter street." over a coral route line. It then compares a 4.9 km fastest route with a 4.7 km shortest route, shows two app screens — planning a ride, then a 4.7 km / 19 min result — and ends on the ink-black download card with the QR code.

## LinkedIn

> Most routing engines answer one question: what's fastest?
>
> I built Short Cut to answer a different one: what's shortest — over streets you're actually allowed to use?
>
> It plans ride or walk routes, reads one-way and access restrictions from OpenStreetMap instead of assuming them, then shows what the conventional fastest route costs you in metres. Same trip: 4.7 km instead of 4.9. Two hundred metres you don't ride.
>
> The other half of the idea is restraint. No account, no analytics, no ads, no background location. Location is read only while the app is open, and trips stay on the device.
>
> It's a 1.0.0 sideload build for Android — free APK, still rough, and the public routing endpoints can be slow. If you're in Hyderabad and want to tell me where the map is wrong, that's the most useful thing you can do with it.
>
> → chandu4143.github.io/shortcut

**Alt text:** same as above.

## Reddit — r/hyderabad

**Title:** I built a distance-first navigation app for Hyderabad — it shows what the "fastest" route costs in extra metres

> I kept noticing that the fastest route home wasn't the shortest one — it just spent fewer minutes on a bigger road. So I built a router that ranks by metres instead, over streets that actually permit your mode of travel (one-way tags and access restrictions come from OpenStreetMap, not assumptions).
>
> The result screen shows both: shortest vs fastest, and the difference. My usual trip is 4.7 km instead of 4.9 — 200 m shorter, 4 minutes slower. Sometimes that's the trade you want; sometimes it isn't, and at least now you can see it.
>
> Ride and walk profiles, live GPS with off-route rerouting, spoken prompts, and it accepts geo:/Google Maps links from other apps.
>
> **Honest limitations:** no live traffic, route quality depends on OSM coverage here, public Valhalla/Overpass endpoints can be slow or rate-limited, and this is a debug-signed sideload APK (not Play Store) for Android 7+.
>
> Free, no account, no ads, no background location. APK + screenshots: https://chandu4143.github.io/shortcut
>
> Would love feedback from people who actually ride these streets — especially any road where the route ignores a no-entry or a blocked access.

**Flair/title notes:** check the sub's self-promotion rule; if links are restricted, post the video natively and answer with the link only when asked.

## Posting notes

- Upload the MP4 natively everywhere. Don't post a YouTube/Vimeo link — native video gets the reach.
- It's silent by design. Add trending audio in the app before posting on X, Instagram or TikTok; keep the volume low so the captions stay the star.
- Captions are burned in, so it works on mute. Nothing is hidden in the audio track.
- 9:16 works on X, LinkedIn (mobile feed), Reddit mobile, Reels, Shorts and TikTok. On LinkedIn desktop it will letterbox — that's fine, but the poster frame is the safe thumbnail.
- Suggested hashtags, sparingly: `#Hyderabad #OpenStreetMap #Android #IndieDev` — no more than two or three.
- Don't promise a Play Store listing or live traffic in replies; the build is a sideload test.

---

## Re-rendering

Source lives in `source/` (HTML timeline + fonts + QR). Serve the repo root so the
app screenshots in `site/assets` resolve:

```sh
python -m http.server 8126
# second terminal: headless Chrome with remote debugging
chrome --headless=new --remote-debugging-port=9222 --window-size=1080,1920 about:blank
node marketing/source/render.mjs
```

Then encode:

```sh
ffmpeg -framerate 30 -i marketing/source/frames/f%05d.jpg \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 19 -preset slow \
  -movflags +faststart -an marketing/shortcut-reel-9x16.mp4
```

The whole timeline is one function, `render(t)` in `source/reel.html` — timings are the
`seg(t, start, end)` calls per beat, so a new beat is a few lines plus a `div`.
