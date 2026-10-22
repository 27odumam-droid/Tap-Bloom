const NWS_ORIGIN = 'https://api.weather.gov';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const SAVED_LOCATIONS_KEY = 'weather-everywhere.saved-locations';
const locationForm = document.querySelector('#locationForm');
const latitudeInput = document.querySelector('#latitude');
const longitudeInput = document.querySelector('#longitude');
const lookupButton = document.querySelector('#lookupButton');
const searchForm = document.querySelector('#searchForm');
const placeSearch = document.querySelector('#placeSearch');
const searchButton = document.querySelector('#searchButton');
const searchMessage = document.querySelector('#searchMessage');
const searchResults = document.querySelector('#searchResults');
const savedMessage = document.querySelector('#savedMessage');
const savedLocationsList = document.querySelector('#savedLocations');
const statusMessage = document.querySelector('#statusMessage');
const forecastContent = document.querySelector('#forecastContent');
const forecastLocation = document.querySelector('#forecastLocation');
const providerLabel = document.querySelector('#providerLabel');
const alertsSection = document.querySelector('#alertsSection');
const alertsMessage = document.querySelector('#alertsMessage');
const alertsList = document.querySelector('#alertsList');
const forecastPeriods = document.querySelector('#forecastPeriods');
const forecastLink = document.querySelector('#forecastLink');
const forecastAttribution = document.querySelector('#forecastAttribution');
const saveLocationForm = document.querySelector('#saveLocationForm');
const savedLocationName = document.querySelector('#savedLocationName');
const saveMessage = document.querySelector('#saveMessage');
const shareButton = document.querySelector('#shareButton');
const shareMessage = document.querySelector('#shareMessage');
const shareLinkLabel = document.querySelector('#shareLinkLabel');
const shareLink = document.querySelector('#shareLink');

let savedLocations = readSavedLocations();
let currentLocation = null;
let activeLookupRequest = 0;

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function readSavedLocations() {
  try {
    const value = localStorage.getItem(SAVED_LOCATIONS_KEY);
    if (value === null) {
      return [];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Saved places have an invalid format.');
    }

    return parsed.filter((location) =>
      location &&
      typeof location.name === 'string' &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      (location.countryCode === undefined || typeof location.countryCode === 'string')
    );
  } catch (error) {
    savedMessage.textContent = error instanceof Error
      ? `Could not load saved places: ${error.message}`
      : 'Could not load saved places from this browser.';
    savedMessage.classList.add('is-error');
    return [];
  }
}

function persistSavedLocations(locations) {
  try {
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
    return true;
  } catch {
    saveMessage.textContent = 'Could not save places in this browser. Check its storage settings.';
    saveMessage.classList.add('is-error');
    return false;
  }
}

function renderSavedLocations() {
  const items = savedLocations.map((location, index) => {
    const item = document.createElement('li');
    item.className = 'saved-location';

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'saved-location-select';
    selectButton.textContent = location.name;
    selectButton.addEventListener('click', () => {
      latitudeInput.value = String(location.latitude);
      longitudeInput.value = String(location.longitude);
      loadForecast(location.latitude, location.longitude, location.name, location.countryCode);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'saved-location-remove';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove ${location.name}`);
    removeButton.addEventListener('click', () => {
      const updatedLocations = savedLocations.filter((_, savedIndex) => savedIndex !== index);
      if (persistSavedLocations(updatedLocations)) {
        savedLocations = updatedLocations;
        saveMessage.textContent = `${location.name} removed from saved places.`;
        saveMessage.classList.remove('is-error');
        renderSavedLocations();
      }
    });

    item.append(selectButton, removeButton);
    return item;
  });

  savedLocationsList.replaceChildren(...items);
  if (savedLocations.length === 0 && !savedMessage.classList.contains('is-error')) {
    savedMessage.textContent = 'Save places you check often for quick access.';
  } else if (savedLocations.length > 0) {
    savedMessage.textContent = `${savedLocations.length} saved ${savedLocations.length === 1 ? 'place' : 'places'} — stored in this browser.`;
    savedMessage.classList.remove('is-error');
  }
}

async function getJson(url, accept = 'application/geo+json') {
  const response = await fetch(url, {
    headers: { Accept: accept }
  });

  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new HttpError(`The request failed (HTTP ${response.status}).`, response.status);
    }
    throw new Error('The weather service returned a response that could not be read as JSON.');
  }

  if (!response.ok) {
    throw new HttpError(
      data.detail || data.title || `The request failed (HTTP ${response.status}).`,
      response.status
    );
  }

  return data;
}

function describePlace(result) {
  return [result.name, result.admin1, result.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ');
}

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add('is-error');
  forecastContent.hidden = true;
}

function makeForecastPeriod(name, temperature, summary, wind, details, isNighttime = false) {
  const item = document.createElement('li');
  item.className = `forecast-period${isNighttime ? ' is-nighttime' : ' is-daytime'}`;

  const heading = document.createElement('h4');
  heading.textContent = name;
  item.append(heading);

  const temperatureText = document.createElement('p');
  temperatureText.className = 'forecast-temperature';
  temperatureText.textContent = temperature;
  item.append(temperatureText);

  if (summary) {
    const summaryText = document.createElement('p');
    summaryText.className = 'forecast-summary';
    summaryText.textContent = summary;
    item.append(summaryText);
  }

  if (wind) {
    const windText = document.createElement('p');
    windText.className = 'forecast-wind';
    windText.textContent = wind;
    item.append(windText);
  }

  if (details) {
    const detailsText = document.createElement('p');
    detailsText.className = 'forecast-details';
    detailsText.textContent = details;
    item.append(detailsText);
  }

  return item;
}

function renderNwsForecast(data) {
  const periods = data?.properties?.periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new Error('The NWS response did not include forecast periods for these coordinates.');
  }

  const cards = periods.map((period) => {
    const temperature = Number.isFinite(period.temperature)
      ? `${period.temperature}°${period.temperatureUnit || ''}`
      : 'Temperature unavailable';
    const wind = [period.windSpeed, period.windDirection].filter(Boolean).join(' ');

    return makeForecastPeriod(
      typeof period.name === 'string' ? period.name : 'Forecast',
      temperature,
      period.shortForecast,
      wind,
      period.detailedForecast,
      period.isDaytime === false
    );
  });

  forecastPeriods.replaceChildren(...cards);
}

function weatherCodeDescription(code) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Conditions unavailable';
}

function compassDirection(degrees) {
  if (!Number.isFinite(degrees)) {
    return '';
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % directions.length];
}

function renderOpenMeteoForecast(data) {
  const daily = data?.daily;
  if (
    !Array.isArray(daily?.time) ||
    !Array.isArray(daily?.temperature_2m_max) ||
    !Array.isArray(daily?.temperature_2m_min) ||
    !Array.isArray(daily?.weather_code)
  ) {
    throw new Error('The global forecast service did not return the expected daily forecast data.');
  }

  const cards = daily.time.map((date, index) => {
    const day = new Date(`${date}T00:00:00Z`);
    const dayName = Number.isNaN(day.valueOf())
      ? date
      : new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(day);
    const high = daily.temperature_2m_max[index];
    const low = daily.temperature_2m_min[index];
    const unit = data.daily_units?.temperature_2m_max || '°';
    const temperature = Number.isFinite(high) && Number.isFinite(low)
      ? `${Math.round(high)}${unit} / ${Math.round(low)}${unit}`
      : 'Temperature unavailable';
    const windSpeed = daily.wind_speed_10m_max?.[index];
    const windDirection = compassDirection(daily.wind_direction_10m_dominant?.[index]);
    const windUnit = data.daily_units?.wind_speed_10m_max || '';
    const wind = Number.isFinite(windSpeed)
      ? `Wind up to ${Math.round(windSpeed)} ${windUnit} ${windDirection}`.trim()
      : '';
    const precipitation = daily.precipitation_probability_max?.[index];
    const details = Number.isFinite(precipitation)
      ? `Chance of precipitation: ${Math.round(precipitation)}%`
      : '';

    return makeForecastPeriod(
      dayName,
      temperature,
      weatherCodeDescription(daily.weather_code[index]),
      wind,
      details
    );
  });

  forecastPeriods.replaceChildren(...cards);
}

function renderAlerts(data) {
  const features = data?.features;
  if (!Array.isArray(features)) {
    throw new Error('The NWS alerts response did not include a valid alert list.');
  }

  if (features.length === 0) {
    alertsMessage.textContent = 'No active NWS alerts for this location.';
    alertsMessage.classList.remove('is-error');
    alertsList.replaceChildren();
    return;
  }

  const items = features.map((feature) => {
    const alert = feature?.properties || {};
    const item = document.createElement('li');
    item.className = 'alert-item';
    if (typeof alert.severity === 'string') {
      item.classList.add(`severity-${alert.severity.toLowerCase()}`);
    }

    const heading = document.createElement('h5');
    heading.textContent = alert.event || alert.headline || 'Weather alert';
    item.append(heading);

    const severity = document.createElement('p');
    severity.className = 'alert-severity';
    severity.textContent = [alert.severity, alert.urgency].filter(Boolean).join(' · ');
    if (severity.textContent) {
      item.append(severity);
    }

    if (typeof alert.headline === 'string' && alert.headline !== heading.textContent) {
      const headline = document.createElement('p');
      headline.textContent = alert.headline;
      item.append(headline);
    }

    if (typeof alert.description === 'string') {
      const description = document.createElement('p');
      description.textContent = alert.description;
      item.append(description);
    }

    return item;
  });

  alertsMessage.textContent = `${features.length} active NWS ${features.length === 1 ? 'alert' : 'alerts'} for this location.`;
  alertsMessage.classList.remove('is-error');
  alertsList.replaceChildren(...items);
}

async function loadNwsAlerts(latitude, longitude, requestId) {
  alertsSection.hidden = false;
  alertsMessage.textContent = 'Checking for active NWS alerts…';
  alertsMessage.classList.remove('is-error');
  alertsList.replaceChildren();

  try {
    const url = new URL('/alerts/active', NWS_ORIGIN);
    url.searchParams.set('point', `${latitude},${longitude}`);
    const data = await getJson(url);
    if (requestId !== activeLookupRequest) {
      return;
    }
    renderAlerts(data);
  } catch (error) {
    if (requestId !== activeLookupRequest) {
      return;
    }
    alertsMessage.textContent = error instanceof TypeError
      ? 'Could not reach the NWS alerts service.'
      : `Could not load NWS alerts: ${error instanceof Error ? error.message : 'Unknown error.'}`;
    alertsMessage.classList.add('is-error');
  }
}

async function getGlobalForecast(latitude, longitude) {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max,wind_direction_10m_dominant');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');
  return getJson(url, 'application/json');
}

function setCoordinateInputs(latitude, longitude) {
  latitudeInput.value = String(latitude);
  longitudeInput.value = String(longitude);
}

function createForecastUrl(location) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('lat', String(location.latitude));
  url.searchParams.set('lon', String(location.longitude));
  url.searchParams.set('name', location.name);
  if (location.countryCode) {
    url.searchParams.set('country', location.countryCode);
  }
  return url;
}

async function loadForecast(latitude, longitude, placeName = '', countryCode = '') {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    showError('Enter a valid latitude (-90 to 90) and longitude (-180 to 180).');
    return;
  }

  setCoordinateInputs(latitude, longitude);
  const requestId = ++activeLookupRequest;
  lookupButton.disabled = true;
  lookupButton.textContent = 'Loading forecast…';
  statusMessage.classList.remove('is-error');
  statusMessage.textContent = 'Checking forecast coverage…';
  forecastContent.hidden = true;
  alertsSection.hidden = true;
  forecastLink.hidden = true;
  forecastLink.removeAttribute('href');
  currentLocation = null;
  saveMessage.textContent = '';
  saveMessage.classList.remove('is-error');

  try {
    let provider = 'NWS';
    let forecastData;
    let displayName = placeName;
    let nwsForecastUrl = '';
    let pointData;

    if (countryCode && countryCode !== 'US') {
      provider = 'Open-Meteo';
      forecastData = await getGlobalForecast(latitude, longitude);
    } else {
      try {
        pointData = await getJson(new URL(`/points/${latitude},${longitude}`, NWS_ORIGIN));
        nwsForecastUrl = pointData?.properties?.forecast;
        if (typeof nwsForecastUrl !== 'string') {
          throw new HttpError('The NWS does not provide a forecast for this location.', 404);
        }

        let parsedUrl;
        try {
          parsedUrl = new URL(nwsForecastUrl);
        } catch {
          throw new Error('The NWS returned an invalid forecast URL.');
        }
        if (parsedUrl.origin !== NWS_ORIGIN || parsedUrl.protocol !== 'https:') {
          throw new Error('The NWS returned an unexpected forecast URL.');
        }
        forecastData = await getJson(parsedUrl);

        const nearby = pointData?.properties?.relativeLocation?.properties;
        if (!displayName && nearby?.city && nearby?.state) {
          displayName = `${nearby.city}, ${nearby.state}`;
        }
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 404) {
          throw error;
        }

        provider = 'Open-Meteo';
        statusMessage.textContent = 'This location is outside NWS forecast coverage. Loading a global forecast…';
        forecastData = await getGlobalForecast(latitude, longitude);
      }
    }

    if (requestId !== activeLookupRequest) {
      return;
    }

    if (provider === 'NWS') {
      renderNwsForecast(forecastData);
      forecastLink.href = nwsForecastUrl;
      forecastLink.textContent = 'View forecast on weather.gov';
      forecastLink.hidden = false;
      alertsSection.hidden = false;
      alertsMessage.textContent = 'Checking for active NWS alerts…';
    } else {
      renderOpenMeteoForecast(forecastData);
      alertsSection.hidden = false;
      alertsMessage.textContent = 'Official NWS alerts are unavailable outside NWS coverage.';
      alertsList.replaceChildren();
    }

    if (!displayName) {
      displayName = `Coordinates ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    }

    forecastLocation.textContent = displayName;
    providerLabel.textContent = `Forecast source: ${provider}`;
    forecastAttribution.textContent = provider === 'Open-Meteo'
      ? 'Weather data provided by Open-Meteo.'
      : 'Weather data provided by the National Weather Service.';
    forecastContent.hidden = false;
    statusMessage.textContent = 'Forecast updated.';
    currentLocation = {
      name: displayName,
      latitude,
      longitude,
      countryCode: countryCode || (provider === 'NWS' ? 'US' : '')
    };
    savedLocationName.value = displayName.slice(0, 60);
    shareMessage.textContent = '';
    shareLink.value = '';
    shareLink.hidden = true;
    shareLinkLabel.hidden = true;

    if (provider === 'NWS') {
      loadNwsAlerts(latitude, longitude, requestId);
    }
  } catch (error) {
    if (requestId !== activeLookupRequest) {
      return;
    }

    if (error instanceof TypeError) {
      showError('Could not reach the weather services. Check your internet connection and try again.');
    } else {
      showError(error instanceof Error ? error.message : 'Weather information is currently unavailable. Please try again.');
    }
  } finally {
    if (requestId === activeLookupRequest) {
      lookupButton.disabled = false;
      lookupButton.textContent = 'Get forecast';
    }
  }
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = placeSearch.value.trim();
  if (!query) {
    searchMessage.textContent = 'Enter a city or place name to search.';
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = 'Searching…';
  searchMessage.textContent = 'Searching places around the world…';
  searchMessage.classList.remove('is-error');
  searchResults.hidden = true;
  searchResults.replaceChildren();

  try {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('name', query);
    url.searchParams.set('count', '6');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    const data = await getJson(url, 'application/json');
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      searchMessage.textContent = 'No matching places found. Try another spelling or add the country.';
      return;
    }

    const items = results.map((result) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      button.textContent = describePlace(result);
      button.addEventListener('click', () => {
        searchResults.hidden = true;
        searchMessage.textContent = `Loading weather for ${button.textContent}…`;
        loadForecast(result.latitude, result.longitude, button.textContent, result.country_code || '');
      });
      item.append(button);
      return item;
    });

    searchResults.replaceChildren(...items);
    searchResults.hidden = false;
    searchMessage.textContent = `${results.length} matching ${results.length === 1 ? 'place' : 'places'} found. Select one to load its forecast.`;
  } catch (error) {
    searchMessage.textContent = error instanceof TypeError
      ? 'Could not reach the global place search service.'
      : `Place search failed: ${error instanceof Error ? error.message : 'Unknown error.'}`;
    searchMessage.classList.add('is-error');
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = 'Search places';
  }
});

shareButton.addEventListener('click', async () => {
  if (!currentLocation) {
    return;
  }

  const url = createForecastUrl(currentLocation).toString();
  const shareData = {
    title: `Weather Everywhere: ${currentLocation.name}`,
    text: `Check this forecast for ${currentLocation.name}.`,
    url
  };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      shareMessage.textContent = 'Forecast shared.';
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        shareMessage.textContent = 'Sharing cancelled.';
        return;
      }
    }
  }

  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('Clipboard access is unavailable.');
    }
    await navigator.clipboard.writeText(url);
    shareMessage.textContent = 'Forecast link copied to the clipboard.';
  } catch {
    shareLink.value = url;
    shareLink.hidden = false;
    shareLinkLabel.hidden = false;
    shareLink.focus();
    shareLink.select();
    shareMessage.textContent = 'Could not copy automatically. Select and copy the link above.';
  }
});

locationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadForecast(Number(latitudeInput.value), Number(longitudeInput.value));
});

saveLocationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = savedLocationName.value.trim();
  if (!currentLocation || !name) {
    saveMessage.textContent = 'Load a forecast and enter a name before saving.';
    saveMessage.classList.add('is-error');
    return;
  }

  const existingIndex = savedLocations.findIndex((location) =>
    location.latitude === currentLocation.latitude &&
    location.longitude === currentLocation.longitude
  );
  const savedPlace = { ...currentLocation, name };
  const updatedLocations = [...savedLocations];
  if (existingIndex === -1) {
    updatedLocations.push(savedPlace);
  } else {
    updatedLocations[existingIndex] = savedPlace;
  }

  if (persistSavedLocations(updatedLocations)) {
    savedLocations = updatedLocations;
    saveMessage.textContent = `${name} saved in this browser.`;
    saveMessage.classList.remove('is-error');
    renderSavedLocations();
  }
});

renderSavedLocations();

const sharedLocationParams = new URLSearchParams(window.location.search);
if (sharedLocationParams.has('lat') || sharedLocationParams.has('lon')) {
  const latitude = Number(sharedLocationParams.get('lat'));
  const longitude = Number(sharedLocationParams.get('lon'));
  if (
    sharedLocationParams.get('lat') === null ||
    sharedLocationParams.get('lon') === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    showError('This forecast link contains invalid coordinates.');
  } else {
    const placeName = (sharedLocationParams.get('name') || '').slice(0, 120);
    const countryCode = sharedLocationParams.get('country') || '';
    loadForecast(latitude, longitude, placeName, countryCode);
  }
}
