# Project instructions

This is a static, worldwide weather dashboard built with plain HTML, CSS, and JavaScript. It uses National Weather Service forecasts and alerts where supported, and Open-Meteo geocoding and forecasts for global coverage.

## Development

- Keep the app runnable by opening `index.html` in a modern browser.
- Use the NWS API at `https://api.weather.gov` for supported U.S. locations and Open-Meteo for global search and forecasts.
- Browser JavaScript cannot set a custom `User-Agent`; keep that limitation documented and visible.
- Clearly distinguish unavailable alerts outside NWS coverage from a successful check with no active alerts.
- Save favorite locations in browser `localStorage` and surface storage errors.
- Build dynamic UI with DOM APIs and `textContent` rather than injecting API data as HTML.
- Keep the interface responsive and accessible, including keyboard focus and status announcements.
- Update `README.md` when user-facing behavior or run instructions change.
