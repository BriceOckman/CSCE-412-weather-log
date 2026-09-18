# Weather Log 🌦️

A tiny static website: search any city, see its current weather, rate how the day felt, and keep a personal weather journal.

## Features

- **City search** — type a city name; geocoding via the free [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api) (no API key needed).
- **Current conditions** — temperature (°C) plus a description and emoji, mapped from [Open-Meteo weather codes](https://open-meteo.com/en/docs) (clear ☀️, cloudy ⛅, fog 🌫️, rain 🌧️, snow ❄️, thunderstorm ⛈️).
- **Mood picker** — rate the day 1–5 with emoji faces and add an optional note.
- **Journal** — "Log this day" saves an entry (date, city, weather, mood, note) to `localStorage`; entries display newest-first with per-entry delete. An empty state shows when nothing is logged.
- **Graceful errors** — friendly inline messages for unknown cities, network failures, and bad API responses; the page never crashes.
- **No build step** — plain HTML + CSS + JS, no frameworks, no CDN assets. All paths are relative, so it works when hosted at any subpath (e.g. GitHub Pages at `https://briceockman.github.io/weather-log/`).

## Run locally

Serve the directory with any static server and open it in a browser:

```sh
cd websites/weather-log
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000` (or the port your server reports).

Note: the weather APIs are fetched live from the browser, so you need an internet connection for city search and current conditions to work.

## Files

| File | Purpose |
| ---- | ------- |
| `index.html` | Page structure; links `styles.css` and `app.js` |
| `styles.css` | Styling — clean, modern, responsive (mobile-friendly) |
| `app.js` | All behavior: search, weather fetch, mood picker, journal |

## Notes

- Journal entries are stored only in your browser (`localStorage` key `weather-log-entries-v1`) — nothing is uploaded anywhere.
- Temperatures are shown in Celsius, the Open-Meteo default.
