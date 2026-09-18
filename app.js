/* Weather Log — app logic.
 * No frameworks, no build step. Uses Open-Meteo's free APIs (no key needed).
 * Journal entries persist in localStorage.
 */
"use strict";

/* ---------------- Constants ---------------- */

var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
var STORAGE_KEY = "weather-log-entries-v1";

/* Open-Meteo WMO weather-code mapping.
 * Source: https://open-meteo.com/en/docs — table of weather code descriptions.
 */
function weatherInfo(code) {
  if (code === 0) return { emoji: "☀️", desc: "Clear sky" };
  if (code === 1) return { emoji: "🌤️", desc: "Mainly clear" };
  if (code === 2) return { emoji: "⛅", desc: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", desc: "Overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫️", desc: "Foggy" };
  if (code >= 51 && code <= 55) return { emoji: "🌧️", desc: "Drizzle" };
  if (code === 56 || code === 57) return { emoji: "🌧️", desc: "Freezing drizzle" };
  if (code >= 61 && code <= 65) return { emoji: "🌧️", desc: "Rain" };
  if (code === 66 || code === 67) return { emoji: "🌧️", desc: "Freezing rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { emoji: "❄️", desc: "Snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", desc: "Rain showers" };
  if (code === 95) return { emoji: "⛈️", desc: "Thunderstorm" };
  if (code === 96 || code === 99) return { emoji: "⛈️", desc: "Thunderstorm with hail" };
  return { emoji: "🌡️", desc: "Unknown conditions" };
}

/* ---------------- DOM refs ---------------- */

var $ = function (id) { return document.getElementById(id); };

var searchForm = $("search-form");
var cityInput = $("city-input");
var searchBtn = $("search-btn");
var searchStatus = $("search-status");

var weatherCard = $("weather-card");
var weatherEmoji = $("weather-emoji");
var weatherTemp = $("weather-temp");
var weatherDesc = $("weather-desc");
var weatherCity = $("weather-city");

var logCard = $("log-card");
var logBtn = $("log-btn");
var logStatus = $("log-status");
var noteInput = $("note-input");
var moodButtons = Array.prototype.slice.call(document.querySelectorAll(".mood"));

var journalList = $("journal-list");
var journalEmpty = $("journal-empty");
var journalCount = $("journal-count");

/* ---------------- State ---------------- */

var currentCity = null;   // { name, country, latitude, longitude }
var currentWeather = null; // { temp, code, emoji, desc }
var selectedMood = 0;

/* ---------------- Helpers ---------------- */

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = "status" + (kind ? " " + kind : "");
}

function clearStatus(el) {
  setStatus(el, "");
}

/* Parse a fetch Response as JSON, throwing a friendly error for HTTP errors. */
function parseJsonOrThrow(res) {
  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }
  return res.json();
}

function friendlyFetchError(err) {
  // TypeError is what fetch throws on network failure / DNS / offline.
  if (err instanceof TypeError) {
    return "Couldn't reach the weather service. Check your connection and try again.";
  }
  return "Something went wrong (" + err.message + "). Please try again.";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEntryDate(entryDate) {
  var d = new Date(entryDate);
  if (isNaN(d.getTime())) return String(entryDate);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function moodEmoji(mood) {
  return ["", "😞", "😐", "🙂", "😊", "🤩"][mood] || "❓";
}

/* ---------------- City search ---------------- */

searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  var query = cityInput.value.trim();
  if (!query) {
    setStatus(searchStatus, "Type a city name first.", "error");
    return;
  }
  searchCity(query);
});

function searchCity(query) {
  setStatus(searchStatus, "Searching for “" + query + "”…", "loading");
  searchBtn.disabled = true;
  hideWeatherAndLog();

  var url = GEOCODE_URL + "?name=" + encodeURIComponent(query) + "&count=1";
  fetch(url)
    .then(parseJsonOrThrow)
    .then(function (data) {
      if (!data.results || data.results.length === 0) {
        setStatus(searchStatus, "No city found for “" + query + "”. Try a different spelling.", "error");
        return;
      }
      var r = data.results[0];
      currentCity = {
        name: r.name,
        country: r.country || "",
        latitude: r.latitude,
        longitude: r.longitude
      };
      var label = currentCity.name + (currentCity.country ? ", " + currentCity.country : "");
      setStatus(searchStatus, "Found " + label + " — fetching weather…", "loading");
      fetchWeather(currentCity, label);
    })
    .catch(function (err) {
      setStatus(searchStatus, friendlyFetchError(err), "error");
    })
    .finally(function () {
      searchBtn.disabled = false;
    });
}

/* ---------------- Current weather ---------------- */

function fetchWeather(city, label) {
  var url = FORECAST_URL +
    "?latitude=" + encodeURIComponent(city.latitude) +
    "&longitude=" + encodeURIComponent(city.longitude) +
    "&current=temperature_2m,weather_code";
  fetch(url)
    .then(parseJsonOrThrow)
    .then(function (data) {
      if (!data.current || typeof data.current.temperature_2m === "undefined") {
        throw new Error("missing current weather in response");
      }
      var info = weatherInfo(data.current.weather_code);
      currentWeather = {
        temp: Math.round(data.current.temperature_2m * 10) / 10,
        code: data.current.weather_code,
        emoji: info.emoji,
        desc: info.desc
      };
      renderWeather(label);
      setStatus(searchStatus, "Showing weather for " + label + ".", "ok");
    })
    .catch(function (err) {
      currentCity = null;
      setStatus(searchStatus, friendlyFetchError(err), "error");
    });
}

function renderWeather(label) {
  weatherEmoji.textContent = currentWeather.emoji;
  weatherTemp.textContent = currentWeather.temp;
  weatherDesc.textContent = currentWeather.desc;
  weatherCity.textContent = label;
  weatherCard.hidden = false;
  logCard.hidden = false;
  resetLogForm();
  clearStatus(logStatus);
}

function hideWeatherAndLog() {
  weatherCard.hidden = true;
  logCard.hidden = true;
  currentWeather = null;
  currentCity = null;
}

/* ---------------- Mood picker ---------------- */

moodButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    selectedMood = parseInt(btn.getAttribute("data-mood"), 10);
    moodButtons.forEach(function (b) {
      var active = b === btn;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-checked", active ? "true" : "false");
    });
    clearStatus(logStatus);
  });
});

function resetLogForm() {
  selectedMood = 0;
  moodButtons.forEach(function (b) {
    b.classList.remove("selected");
    b.setAttribute("aria-checked", "false");
  });
  noteInput.value = "";
}

/* ---------------- Journal (localStorage) ---------------- */

function loadEntries() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    return false; // e.g. quota exceeded / private mode
  }
}

logBtn.addEventListener("click", function () {
  if (!currentCity || !currentWeather) {
    setStatus(logStatus, "Search a city and load its weather first.", "error");
    return;
  }
  if (!selectedMood) {
    setStatus(logStatus, "Pick a mood (1–5) before logging.", "error");
    return;
  }

  var entry = {
    id: Date.now() + "-" + Math.floor(Math.random() * 100000),
    date: new Date().toISOString(),
    city: currentCity.name + (currentCity.country ? ", " + currentCity.country : ""),
    temp: currentWeather.temp,
    weatherEmoji: currentWeather.emoji,
    weatherDesc: currentWeather.desc,
    mood: selectedMood,
    note: noteInput.value.trim()
  };

  var entries = loadEntries();
  entries.unshift(entry); // newest first
  if (!saveEntries(entries)) {
    setStatus(logStatus, "Couldn't save — browser storage is unavailable.", "error");
    return;
  }

  renderJournal();
  resetLogForm();
  setStatus(logStatus, "Logged! ✍️ Entry added to your journal.", "ok");
});

journalList.addEventListener("click", function (event) {
  var btn = event.target.closest(".entry-delete");
  if (!btn) return;
  var id = btn.getAttribute("data-id");
  var entries = loadEntries().filter(function (e) { return e.id !== id; });
  saveEntries(entries);
  renderJournal();
});

function renderJournal() {
  var entries = loadEntries();
  journalEmpty.style.display = entries.length ? "none" : "";
  journalCount.textContent = entries.length
    ? entries.length + (entries.length === 1 ? " entry" : " entries")
    : "";

  journalList.innerHTML = "";
  entries.forEach(function (entry) {
    var li = document.createElement("li");
    li.className = "entry";

    var body = '<div class="entry-body">' +
      '<div class="entry-top">' +
        '<span class="entry-date">' + escapeHtml(formatEntryDate(entry.date)) + '</span>' +
        '<span class="entry-city">' + escapeHtml(entry.city || "Unknown city") + '</span>' +
        '<span class="entry-mood" title="Mood: ' + escapeHtml(entry.mood) + '/5">' +
          escapeHtml(moodEmoji(entry.mood)) + '</span>' +
      '</div>' +
      '<div class="entry-conditions">' + escapeHtml(entry.temp) + ' °C · ' +
        escapeHtml(entry.weatherDesc || "") + '</div>' +
      (entry.note
        ? '<p class="entry-note">' + escapeHtml(entry.note) + '</p>'
        : "") +
    '</div>';

    li.innerHTML =
      '<span class="entry-weather" aria-hidden="true">' + escapeHtml(entry.weatherEmoji || "🌡️") + '</span>' +
      body +
      '<button type="button" class="entry-delete" data-id="' + escapeHtml(entry.id) +
        '" aria-label="Delete entry from ' + escapeHtml(formatEntryDate(entry.date)) + '">Delete</button>';

    journalList.appendChild(li);
  });
}

/* ---------------- Init ---------------- */

renderJournal();
