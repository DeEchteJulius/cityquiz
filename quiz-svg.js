const mode = localStorage.getItem('quizMode') || 'world';
let cities = [], guessedCities = [];
let totalPopulation = 0;
let extreme = { north: null, south: null };
let bounds = { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 }; // fallback


let input, cityList, cityCount, populationDisplay;
let northEl, northCoords, southEl, southCoords;

// === Run after DOM + SVG load ===
async function init() {
  input = document.getElementById('cityInput');
  cityList = document.getElementById('cityList');
  cityCount = document.getElementById('cityCount');
  populationDisplay = document.getElementById('populationCovered');

  northEl = document.getElementById('northernmost');
  northCoords = document.getElementById('northernmostCoords');
  southEl = document.getElementById('southernmost');
  southCoords = document.getElementById('southernmostCoords');

  await loadMapBounds();
  await loadSVGMap();
  await loadCityData();
  setupInputListener();
}

async function loadMapBounds() {
  try {
    const res = await fetch("data/map_bounds.json");

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while fetching map_bounds.json`);
    }

    const allBounds = await res.json();

    if (mode in allBounds) {
      bounds = allBounds[mode];
      console.log(`Loaded bounds for mode: ${mode}`, bounds);
    } else {
      console.warn(`⚠️ No bounds found for mode: ${mode}. Using world defaults.`);
      bounds = {
        latMin: -90,
        latMax: 90,
        lngMin: -180,
        lngMax: 180
      };
    }

  } catch (e) {
    console.error("❌ Failed to load map_bounds.json:", e);
    // Optional: assign fallback bounds in case of network failure or malformed JSON
    bounds = {
      latMin: -90,
      latMax: 90,
      lngMin: -180,
      lngMax: 180
    };
  }
}


async function loadSVGMap() {
  const res = await fetch(`maps/${mode}.svg`);
  const svgText = await res.text();
  const svgMapContainer = document.getElementById('svgMapContainer');
  svgMapContainer.innerHTML = svgText;

  const svg = svgMapContainer.querySelector('svg');
  if (!svg.viewBox.baseVal || svg.viewBox.baseVal.width === 0) {
    // fallback: inject a viewBox based on width/height
    const width = svg.getAttribute('width');
    const height = svg.getAttribute('height');
    if (width && height) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
  }

  await new Promise(requestAnimationFrame);
  setupPanzoom();
}



function setupPanzoom() {
  const svg = document.querySelector('#svgMapContainer svg');
  if (!svg) return;

  const panZoomInstance = svgPanZoom(svg, {
    zoomEnabled: true,
    controlIconsEnabled: true,
    fit: true,
    center: true,
    minZoom: 0.5,
    maxZoom: 10,
    zoomScaleSensitivity: 0.2
  });

}

async function loadCityData() {
  const res = await fetch(`data/cities/${mode}.json`);
  cities = await res.json();
  updateDynamicStats(cities);
  await populateDropdown(mode, cities); // added
}

async function populateDropdown(mode, cities) {
  const filter = document.getElementById('countryFilter');
  const added = new Set();

  filter.innerHTML = '';
  filter.innerHTML += `
    <option value="">Any Country or State</option>
    <option value="__ALL_COUNTRIES__"> Every Country</option>
    <option value="__ALL_STATES__"> Every Region/State</option>
  `;

  function addOption(label) {
    if (!label || added.has(label)) return;
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    filter.appendChild(opt);
    added.add(label);
  }

  const countryLabels = new Set();
  const stateLabels = new Set();

  cities.forEach(c => {
    if (c.country) countryLabels.add(c.country);
    if (c.state) stateLabels.add(c.state);
  });

  [...countryLabels].sort().forEach(addOption);
  [...stateLabels].sort().forEach(addOption);

  try {
    const res = await fetch(`data/states/states-${mode}.json`);
    const regions = await res.json();
    regions.forEach(r => {
      addOption(r.name);
      if (Array.isArray(r.altNames)) {
        r.altNames.forEach(alt => addOption(alt));
      }
    });
  } catch (e) {
    console.log(`No state/region data for ${mode}`);
  }
}


function updateDynamicStats(cities) {
  const list = document.getElementById('dynamicStatsList');
  list.innerHTML = '';
  

  

  const populationBrackets = [
    { label: "5,000,000", key: "over5M", threshold: 5000000 },
    { label: "1,000,000", key: "over1M", threshold: 1000000 },
    { label: "500,000", key: "over500K", threshold: 500000 },
    { label: "100,000", key: "over100K", threshold: 100000 },
    { label: "50,000", key: "over50K", threshold: 50000 },
	{ label: "10,000", key: "over10K", threshold: 10000 }
	  
	
  ];

  let capitalCount = 0;
  let territorySet = new Set();
  let countrySet = new Set();

  populationBrackets.forEach(bracket => {
    const count = cities.filter(c => c.population >= bracket.threshold).length;
    if (count > 0) {
      const li = document.createElement('li');
      li.innerHTML = `<strong id="${bracket.key}">0</strong> of ${count} cities over ${bracket.label}`;
      list.appendChild(li);
    }
  });

  cities.forEach(city => {
    if (city.nationalCapital || city.stateCapital) capitalCount++;
    if (city.state) territorySet.add(city.state);
    if (city.country) countrySet.add(city.country);
  });

  list.innerHTML += `
    <li><strong id="countryCount">0</strong> of ${countrySet.size} countries</li>
    <li><strong id="capitalCount">0</strong> of ${capitalCount} capitals</li>
    <li><strong id="territoryCount">0</strong> of ${territorySet.size} territories</li>
  `;
}


function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[\.\-']/g, "")
    .toLowerCase()
    .trim();
}

function findMatchingCity(guess, cities) {
  const normalizedGuess = normalize(guess);
  const matches = cities.filter(c =>
    normalize(c.name) === normalizedGuess ||
    (c.altNames || []).some(n => normalize(n) === normalizedGuess)
  );
  // Sort descending by population
  matches.sort((a, b) => (b.population || 0) - (a.population || 0));
  return matches[0]; // Return most populous match
}

function setupInputListener() {
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;

    const guess = input.value;
    input.value = '';
    if (!guess.trim()) return;

    const match = findMatchingCity(guess, cities);
    if (!match) return;

    const cityKey = `${match.name}|${match.state}|${match.country}`;
    if (guessedCities.includes(cityKey)) return;

    guessedCities.push(cityKey);
    totalPopulation += match.population || 0;

    updateStats(match);
    addCityToList(match);
    markCityOnSVG(match);
  });
}


function addCityToList(city) {
  const li = document.createElement('li');
  li.textContent = `${city.name} ${city.state}, ${city.country} (${city.population.toLocaleString()})`;
  if (city.nationalCapital || city.stateCapital) li.textContent += ' 📍';

  cityList.prepend(li);  // ⬅️ Add to top instead of bottom
  cityCount.textContent = guessedCities.length;
  populationDisplay.textContent = totalPopulation.toLocaleString();
}


function updateStats(city) {
  if (!extreme.north || city.latitude > extreme.north.latitude) extreme.north = city;
  if (!extreme.south || city.latitude < extreme.south.latitude) extreme.south = city;

  northEl.textContent = `${extreme.north.name}, ${extreme.north.country}`;
  northCoords.textContent = ` (${extreme.north.latitude.toFixed(2)}°, ${extreme.north.longitude.toFixed(2)}°)`;

  southEl.textContent = `${extreme.south.name}, ${extreme.south.country}`;
  southCoords.textContent = ` (${extreme.south.latitude.toFixed(2)}°, ${extreme.south.longitude.toFixed(2)}°)`;
}

function markCityOnSVG(city) {
  const svg = document.querySelector("#svgMapContainer svg");
  if (!svg) return;

  const point = latLonToSVGCoords(city.latitude, city.longitude, svg.getBoundingClientRect());
  if (!point) return;

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", point.x);
  circle.setAttribute("cy", point.y);

  // Scale radius by population
  const minPop = 100;
  const maxPop = 20000000;
  const pop = Math.max(minPop, city.population || minPop);
  const radius = 3 + 9 * Math.min((pop - minPop) / (maxPop - minPop), 1);
  circle.setAttribute("r", radius.toFixed(1));

  // Style
  circle.setAttribute("fill", city.stateCapital ? "#FFD700" : "#4285F4");
  circle.setAttribute("fill", city.nationalCapital ? "#FFD700" : "#4285F4");
  circle.setAttribute("stroke", "#222");
  circle.setAttribute("stroke-width", "0.6");
  circle.setAttribute("opacity", "0.85");

  // Tooltip
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  const formattedPop = city.population?.toLocaleString?.("en-US") || "Unknown";
  title.textContent = `${city.name}, ${city.state}, ${city.country} (${formattedPop})`;
  circle.appendChild(title);

  svg.appendChild(circle);
}




// Kick off everything once DOM is ready
window.addEventListener('DOMContentLoaded', init);
