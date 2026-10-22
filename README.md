# Weather Everywhere

A static weather dashboard that searches for places around the world, displays forecasts, and lets you save favorite locations in your browser.

## Run it

Open `index.html` in a modern web browser. Search for a city or place and select a result, or enter latitude and longitude directly. Use **Save place** to keep a location in this browser for quick access.

No API key, installation, or build step is required.

## Share a forecast

After loading a forecast, choose **Share forecast** to share it with your device's share menu or copy a link. The link includes the location coordinates and name, and loads that forecast when opened. To share with other people, host this static app at a URL they can access; links created while opening `index.html` directly point to a local file on your device.

## Weather data and coverage

- U.S. locations use the National Weather Service API. The app looks up `/points/{latitude},{longitude}`, loads its forecast URL, and checks for active alerts at the selected coordinates.
- Locations outside NWS forecast coverage use Open-Meteo for a seven-day global forecast. NWS alerts are not available outside NWS coverage, and the dashboard labels them as unavailable rather than reporting that there are no alerts.
- Place-name search uses Open-Meteo's geocoding service.
- Saved locations are stored in browser `localStorage`; they do not sync between devices.
- Shared forecast links encode the selected location in the page URL; they do not include saved places or forecast data.

## User-Agent limitation

The NWS API asks applications to identify themselves with a `User-Agent`. Browser JavaScript cannot set or override that header, so this static app uses the browser's automatically supplied `User-Agent`. A server-side proxy would be needed to send an app-specific value.
