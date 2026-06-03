/* ==========================================================================
   SKYWEAR - DASHBOARD & OUTDOOR APPAREL ENGINE (app.js)
   ========================================================================== */

// --- 1. APPLICATION STATE ---
const state = {
    unit: localStorage.getItem('skywear_unit') || 'C', // 'C' or 'F'
    currentLocation: JSON.parse(localStorage.getItem('skywear_location')) || {
        name: "London",
        country: "United Kingdom",
        lat: 51.5085,
        lon: -0.1257
    },
    weatherData: null,
    searchDebounceTimer: null
};

// --- 2. WMO WEATHER CODES INDEX ---
// Maps Open-Meteo code values to display name, icon name, and theme classification
const weatherCodesIndex = {
    0: { text: "Clear Sky", icon: "sun", theme: "sunny" },
    1: { text: "Mainly Clear", icon: "cloud-sun", theme: "sunny" },
    2: { text: "Partly Cloudy", icon: "cloud-sun", theme: "cloudy" },
    3: { text: "Overcast", icon: "cloud", theme: "cloudy" },
    45: { text: "Foggy", icon: "cloud-fog", theme: "cloudy" },
    48: { text: "Depositing Rime Fog", icon: "cloud-fog", theme: "cloudy" },
    51: { text: "Light Drizzle", icon: "cloud-drizzle", theme: "rainy" },
    53: { text: "Moderate Drizzle", icon: "cloud-drizzle", theme: "rainy" },
    55: { text: "Dense Drizzle", icon: "cloud-drizzle", theme: "rainy" },
    56: { text: "Light Freezing Drizzle", icon: "cloud-snow", theme: "snowy" },
    57: { text: "Dense Freezing Drizzle", icon: "cloud-snow", theme: "snowy" },
    61: { text: "Slight Rain", icon: "cloud-rain", theme: "rainy" },
    63: { text: "Moderate Rain", icon: "cloud-rain", theme: "rainy" },
    65: { text: "Heavy Rain", icon: "cloud-rain", theme: "rainy" },
    66: { text: "Light Freezing Rain", icon: "cloud-snow", theme: "snowy" },
    67: { text: "Heavy Freezing Rain", icon: "cloud-snow", theme: "snowy" },
    71: { text: "Slight Snowfall", icon: "snowflake", theme: "snowy" },
    73: { text: "Moderate Snowfall", icon: "snowflake", theme: "snowy" },
    75: { text: "Heavy Snowfall", icon: "snowflake", theme: "snowy" },
    77: { text: "Snow Grains", icon: "snowflake", theme: "snowy" },
    80: { text: "Slight Rain Showers", icon: "cloud-rain", theme: "rainy" },
    81: { text: "Moderate Rain Showers", icon: "cloud-rain", theme: "rainy" },
    82: { text: "Violent Rain Showers", icon: "cloud-rain", theme: "rainy" },
    85: { text: "Slight Snow Showers", icon: "cloud-snow", theme: "snowy" },
    86: { text: "Heavy Snow Showers", icon: "cloud-snow", theme: "snowy" },
    95: { text: "Thunderstorm", icon: "cloud-lightning", theme: "rainy" },
    96: { text: "Thunderstorm with Hail", icon: "cloud-lightning", theme: "rainy" },
    99: { text: "Heavy Thunderstorm with Hail", icon: "cloud-lightning", theme: "rainy" }
};

// Get default weather details for unmapped codes
function getWeatherInfo(code) {
    return weatherCodesIndex[code] || { text: "Unidentified weather", icon: "help-circle", theme: "default" };
}

// --- 3. DOM ELEMENTS ELEMENT DICTIONARY ---
const DOM = {
    body: document.body,
    cityInput: document.getElementById('city-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    suggestionsDropdown: document.getElementById('search-suggestions'),
    unitC: document.getElementById('unit-c'),
    unitF: document.getElementById('unit-f'),
    locationName: document.getElementById('location-name'),
    localTime: document.getElementById('local-time'),
    currentTemp: document.getElementById('current-temp'),
    weatherIconLarge: document.getElementById('weather-icon-large'),
    weatherDescription: document.getElementById('weather-description'),
    tempHigh: document.getElementById('temp-high'),
    tempLow: document.getElementById('temp-low'),
    statHumidity: document.getElementById('stat-humidity'),
    statWind: document.getElementById('stat-wind'),
    statRain: document.getElementById('stat-rain'),
    outfitSummary: document.getElementById('outfit-summary'),
    valOuterwear: document.getElementById('val-outerwear'),
    valTop: document.getElementById('val-top'),
    valBottom: document.getElementById('val-bottom'),
    valFootwear: document.getElementById('val-footwear'),
    valAcc1: document.getElementById('val-acc-1'),
    valAcc2: document.getElementById('val-acc-2'),
    hourlyScrollContainer: document.getElementById('hourly-scroll-container'),
    svgChartContainer: document.getElementById('svg-chart-container'),
    dailyForecastContainer: document.getElementById('daily-forecast-container'),
    valUv: document.getElementById('val-uv'),
    descUv: document.getElementById('desc-uv'),
    valPressure: document.getElementById('val-pressure'),
    descPressure: document.getElementById('desc-pressure'),
    valVisibility: document.getElementById('val-visibility'),
    descVisibility: document.getElementById('desc-visibility'),
    valWindDir: document.getElementById('val-wind-dir'),
    descWindDir: document.getElementById('desc-wind-dir')
};

// --- 4. MATHEMATICAL CONVERSIONS & FORMATTERS ---
function cToF(celsius) {
    return Math.round((celsius * 9/5) + 32);
}

function formatTemp(tempC) {
    if (state.unit === 'F') {
        return cToF(tempC);
    }
    return Math.round(tempC);
}

function getWindSpeedFormatted(speedKmh) {
    if (state.unit === 'F') {
        const mph = speedKmh * 0.621371;
        return `${Math.round(mph)} mph`;
    }
    return `${Math.round(speedKmh)} km/h`;
}

function getWindDirectionText(degree) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((degree % 360) / 45)) % 8;
    return directions[idx];
}

// --- 5. SMART OUTFIT RECOMMENDATION ENGINE ---
function buildOutfitRecommendation(tempC, windKmh, rainProb, uvIndex, weatherCode) {
    let recommendation = {
        outerwear: "None",
        top: "Regular T-shirt",
        bottom: "Shorts or Chinos",
        footwear: "Light Sneakers",
        accessory1: "None",
        accessory2: "Watch",
        summary: ""
    };

    // WMO lists freezing or rainy situations
    const isRaining = rainProb > 30 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
    const isSnowing = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode);
    const isVeryWindy = windKmh > 24;

    // A. Temperature logic
    if (tempC < 0) { // Sub-zero
        recommendation.outerwear = "Heavy Down Parka";
        recommendation.top = "Thermal Sweater + Base Layer";
        recommendation.bottom = "Thermal Pants or Fleece-lined Jeans";
        recommendation.footwear = "Insulated Winter Boots";
        recommendation.accessory1 = "Insulated Gloves & Scarf";
        recommendation.accessory2 = "Warm Wool Beanie";
        recommendation.summary = "Sub-zero temperatures! Bundle up heavily in layered thermals, a thick insulated parka, boots, and keep your hands, ears, and neck covered.";
    } 
    else if (tempC >= 0 && tempC < 8) { // Ice Cold
        recommendation.outerwear = "Thick Winter Coat";
        recommendation.top = "Warm Wool Sweater";
        recommendation.bottom = "Heavy Denim Jeans";
        recommendation.footwear = "Leather Boots / High-Tops";
        recommendation.accessory1 = "Light Gloves";
        recommendation.accessory2 = "Beanie or Ear Muffs";
        recommendation.summary = "It's freezing. A thick winter coat combined with a heavy wool sweater and boots will protect you from the chill.";
    } 
    else if (tempC >= 8 && tempC < 15) { // Chilly
        recommendation.outerwear = "Puffer Jacket or Trench Coat";
        recommendation.top = "Long-Sleeve Knit / Cardigan";
        recommendation.bottom = "Chinos or Cotton Jeans";
        recommendation.footwear = "Comfortable Sneakers";
        recommendation.accessory1 = "Light Scarf";
        recommendation.accessory2 = "Lip Balm";
        recommendation.summary = "Chilly conditions. Layering is key: a mid-weight jacket or trench over a long-sleeve knit will keep you snug.";
    } 
    else if (tempC >= 15 && tempC < 22) { // Mild/Pleasant
        recommendation.outerwear = "Light Hoodie or Denim Jacket";
        recommendation.top = "Classic Cotton T-Shirt";
        recommendation.bottom = "Relaxed Chinos / Cargo Pants";
        recommendation.footwear = "Everyday Sneakers";
        recommendation.accessory1 = "None";
        recommendation.accessory2 = "Stylish Sunglasses";
        recommendation.summary = "Perfect mild weather. A light layer like a hoodie, sweater, or denim jacket over a tee is ideal for this breeze.";
    } 
    else if (tempC >= 22 && tempC < 30) { // Warm
        recommendation.outerwear = "None needed";
        recommendation.top = "Linen Shirt or Polo";
        recommendation.bottom = "Breathable Shorts or Cotton Skirt";
        recommendation.footwear = "Low-Top Sneakers / Canvas shoes";
        recommendation.accessory1 = "Polarized Sunglasses";
        recommendation.accessory2 = "Hydration Bottle";
        recommendation.summary = "Warm and pleasant temperature. Dress in light, breathable cotton or linen fabrics, shorts, and stay hydrated.";
    } 
    else { // Hot (30C+)
        recommendation.outerwear = "None";
        recommendation.top = "Loose Tank Top / Airy Tee";
        recommendation.bottom = "Light Shorts or Athletic Wear";
        recommendation.footwear = "Breathable Sandals / Slides";
        recommendation.accessory1 = "Wide-Brimmed Hat";
        recommendation.accessory2 = "SPF 50+ Sunscreen";
        recommendation.summary = "Scorching hot weather! Dress in minimal, loose-fitting, light-colored clothing. Wear a hat, sunglasses, and apply plenty of sunscreen.";
    }

    // B. Rain modifiers
    if (isRaining) {
        recommendation.accessory1 = "Sturdy Umbrella";
        recommendation.footwear = "Waterproof Boots / Leather Shoes";
        if (tempC >= 18) {
            recommendation.outerwear = "Water-resistant Windbreaker";
            recommendation.summary += " Warning: Rain detected! Swap to water-resistant outerwear and carry an umbrella.";
        } else {
            recommendation.outerwear = "Waterproof Raincoat / Parka";
            recommendation.summary += " Wet weather alert! Ensure your outer coat is fully waterproof and wear slip-resistant boots.";
        }
    }

    // C. Snow modifiers
    if (isSnowing) {
        recommendation.outerwear = "Waterproof Winter Coat";
        recommendation.footwear = "Snow Boots (Deep Tread)";
        recommendation.accessory1 = "Thermal Gloves";
        recommendation.accessory2 = "Warm Beanie";
        recommendation.summary += " Snowy conditions present. Wear insulated boots with good grip to prevent slips, and ensure outerwear is waterproof to keep snow melt dry.";
    }

    // D. Heavy Wind modifier
    if (isVeryWindy && !isRaining && !isSnowing) {
        recommendation.outerwear = "Windproof Shell Jacket";
        recommendation.accessory2 = "Hair Band / Secure Cap";
        recommendation.summary += " Strong winds are active; a windproof shell/windbreaker will keep windchill low.";
    }

    // E. High UV modifiers
    if (uvIndex >= 6) {
        recommendation.accessory1 = "Polarized UV Sunglasses";
        recommendation.accessory2 = "SPF 50+ Sunscreen & Cap";
        recommendation.summary += " High UV warning! Shield your skin with sunscreen, and wear sunglasses/hat to protect your eyes.";
    }

    return recommendation;
}

// --- 6. API UTILITIES (WEATHER & GEOCODING) ---

// Fetch cities matching query input
async function fetchCityCoordinates(query) {
    if (!query || query.trim().length < 2) return [];
    
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Geocoding service error");
        const data = await response.json();
        return data.results || [];
    } catch (err) {
        console.error("Geocoding failed:", err);
        return [];
    }
}

// Fetch forecast data from Open-Meteo for coordinates
async function fetchWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,visibility,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum&timezone=auto`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Weather forecast service error");
        return await response.json();
    } catch (err) {
        console.error("Weather fetch failed:", err);
        alert("Failed to retrieve weather data. Please check your internet connection.");
        return null;
    }
}

// --- 7. DYNAMIC UI RENDERING FUNCTIONS ---

// Update main layout with fetched weather and recommendations
function updateDashboardUI() {
    const data = state.weatherData;
    if (!data) return;
    
    const current = data.current;
    const daily = data.daily;
    const weatherInfo = getWeatherInfo(current.weather_code);
    
    // Set weather theme
    DOM.body.className = `theme-${weatherInfo.theme}`;

    // Header info & Location
    DOM.locationName.textContent = `${state.currentLocation.name}, ${state.currentLocation.country}`;
    
    // Local Time (using returned timezone string)
    const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: data.timezone };
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: data.timezone };
    const now = new Date();
    DOM.localTime.textContent = `${now.toLocaleDateString('en-US', dateOptions)} • Local Time: ${now.toLocaleTimeString('en-US', timeOptions)}`;

    // Temp displays
    DOM.currentTemp.textContent = formatTemp(current.temperature_2m);
    DOM.weatherDescription.textContent = weatherInfo.text;
    DOM.tempHigh.textContent = formatTemp(daily.temperature_2m_max[0]);
    DOM.tempLow.textContent = formatTemp(daily.temperature_2m_min[0]);
    
    // Replace big icon
    DOM.weatherIconLarge.innerHTML = `<i data-lucide="${weatherInfo.icon}" class="large-icon animate-pulse"></i>`;
    
    // Stat badges
    DOM.statHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
    DOM.statWind.textContent = getWindSpeedFormatted(current.wind_speed_10m);
    DOM.statRain.textContent = `${Math.round(data.hourly.precipitation_probability[0])}%`;

    // Smart outfit advisor updates
    const currentUV = data.hourly.uv_index[0] || 0;
    const outfit = buildOutfitRecommendation(
        current.temperature_2m,
        current.wind_speed_10m,
        data.hourly.precipitation_probability[0],
        currentUV,
        current.weather_code
    );

    DOM.outfitSummary.textContent = outfit.summary;
    DOM.valOuterwear.textContent = outfit.outerwear;
    DOM.valTop.textContent = outfit.top;
    DOM.valBottom.textContent = outfit.bottom;
    DOM.valFootwear.textContent = outfit.footwear;
    DOM.valAcc1.textContent = outfit.accessory1;
    DOM.valAcc2.textContent = outfit.accessory2;

    // Detailed metrics
    DOM.valUv.textContent = `${Math.round(currentUV)}`;
    let uvText = "Low";
    if (currentUV >= 3 && currentUV < 6) uvText = "Moderate";
    else if (currentUV >= 6 && currentUV < 8) uvText = "High";
    else if (currentUV >= 8) uvText = "Very High/Extreme";
    DOM.descUv.textContent = `${uvText} protection needed`;

    const pressure = data.hourly.pressure_msl[0] || 1013;
    DOM.valPressure.textContent = `${Math.round(pressure)} hPa`;
    let pressureText = "Normal";
    if (pressure > 1020) pressureText = "High Pressure (Clear)";
    else if (pressure < 1009) pressureText = "Low Pressure (Stormy)";
    DOM.descPressure.textContent = pressureText;

    const visibilityKm = (data.hourly.visibility[0] || 10000) / 1000;
    DOM.valVisibility.textContent = `${Math.round(visibilityKm)} km`;
    let visibilityText = "Excellent";
    if (visibilityKm < 2) visibilityText = "Poor (Foggy/Mist)";
    else if (visibilityKm >= 2 && visibilityKm < 8) visibilityText = "Moderate";
    DOM.descVisibility.textContent = `${visibilityText} visibility`;

    const windDir = current.wind_direction_10m || 0;
    DOM.valWindDir.textContent = `${windDir}° ${getWindDirectionText(windDir)}`;
    DOM.descWindDir.textContent = `Blowing from ${getWindDirectionText(windDir + 180)}`;

    // Render hourly timeline lists
    renderHourlyList();

    // Render 7-day weather list
    render7DayList();

    // Initialize all Lucide Icons in DOM
    lucide.createIcons();
}

// Render dynamic horizontally scrollable list
function renderHourlyList() {
    const hourly = state.weatherData.hourly;
    DOM.hourlyScrollContainer.innerHTML = '';
    
    // Display next 12 hours
    const limit = 12;
    for (let i = 0; i < limit; i++) {
        const timeVal = new Date(hourly.time[i]);
        const formattedTime = timeVal.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        
        const code = hourly.weather_code[i];
        const iconInfo = getWeatherInfo(code);
        
        const itemHtml = `
            <div class="hourly-item">
                <span class="hourly-time">${i === 0 ? "Now" : formattedTime}</span>
                <i data-lucide="${iconInfo.icon}" class="hourly-icon"></i>
                <span class="hourly-temp">${formatTemp(hourly.temperature_2m[i])}°</span>
            </div>
        `;
        DOM.hourlyScrollContainer.insertAdjacentHTML('beforeend', itemHtml);
    }

    // Render Custom SVG inline line chart
    renderSVGChart(hourly.temperature_2m.slice(0, limit));
}

// Generate the inline SVG vector temperature line graph
function renderSVGChart(temps) {
    DOM.svgChartContainer.innerHTML = '';
    
    const w = DOM.svgChartContainer.clientWidth || 1000;
    const h = 90;
    const padding = 15;
    
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const tempRange = (maxTemp - minTemp) || 1;
    
    const points = temps.map((temp, index) => {
        const x = padding + (index * (w - padding * 2) / (temps.length - 1));
        // Invert Y mapping since SVG coord 0 is at the top
        const y = h - padding - ((temp - minTemp) / tempRange * (h - padding * 2));
        return { x, y, temp };
    });
    
    // Construct line SVG path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Construct SVG gradient fill path (closes bottom boundary)
    const fillD = `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

    // Construct SVG nodes string
    let svgHtml = `
        <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chart-fill-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <!-- Fill Gradient Under the Line -->
            <path d="${fillD}" fill="url(#chart-fill-grad)" />
            <!-- Main Temperature Stroke -->
            <path d="${pathD}" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" />
            
            <!-- Plot circles & floating text value values -->
    `;

    points.forEach((pt) => {
        svgHtml += `
            <circle cx="${pt.x}" cy="${pt.y}" r="3" fill="var(--text-primary)" stroke="var(--accent-color)" stroke-width="1.5" />
            <text x="${pt.x}" y="${pt.y - 6}" font-size="8.5" font-weight="700" fill="var(--text-secondary)" text-anchor="middle">
                ${formatTemp(pt.temp)}°
            </text>
        `;
    });

    svgHtml += `</svg>`;
    DOM.svgChartContainer.innerHTML = svgHtml;
}

// Render 7-day daily forecast items
function render7DayList() {
    const daily = state.weatherData.daily;
    DOM.dailyForecastContainer.innerHTML = '';
    
    for (let i = 0; i < daily.time.length; i++) {
        const dateVal = new Date(daily.time[i]);
        // Shift time offset index to ignore yesterday values if timezone wraps
        const options = { weekday: 'long' };
        const dayLabel = i === 0 ? "Today" : dateVal.toLocaleDateString('en-US', options);
        
        const code = daily.weather_code[i];
        const iconInfo = getWeatherInfo(code);
        
        const itemHtml = `
            <div class="daily-item">
                <span class="daily-day">${dayLabel}</span>
                <div class="daily-weather">
                    <i data-lucide="${iconInfo.icon}" class="daily-icon"></i>
                </div>
                <div class="daily-temp-range">
                    <span class="daily-high">${formatTemp(daily.temperature_2m_max[i])}°</span>
                    <span class="daily-low">${formatTemp(daily.temperature_2m_min[i])}°</span>
                </div>
            </div>
        `;
        
        DOM.dailyForecastContainer.insertAdjacentHTML('beforeend', itemHtml);
    }
}

// --- 8. STATE ACTIONS & HANDLERS ---

// Trigger dashboard weather refresh for stored location coordinate attributes
async function loadWeatherDataForCurrentLocation() {
    // Show loading skeleton triggers
    toggleLoadingState(true);
    
    const data = await fetchWeatherData(state.currentLocation.lat, state.currentLocation.lon);
    if (data) {
        state.weatherData = data;
        updateDashboardUI();
    }
    
    toggleLoadingState(false);
}

// Add/Remove skeleton loading style overlays
function toggleLoadingState(isLoading) {
    const targets = [
        DOM.locationName, DOM.currentTemp, DOM.weatherDescription,
        DOM.tempHigh, DOM.tempLow, DOM.statHumidity, DOM.statWind, DOM.statRain,
        DOM.outfitSummary, DOM.valOuterwear, DOM.valTop, DOM.valBottom,
        DOM.valFootwear, DOM.valAcc1, DOM.valAcc2, DOM.valUv, DOM.valPressure,
        DOM.valVisibility, DOM.valWindDir
    ];
    
    targets.forEach(el => {
        if (el) {
            if (isLoading) el.classList.add('loading-skeleton');
            else el.classList.remove('loading-skeleton');
        }
    });
}

// Handle location selection from search drop selection
function selectCity(city) {
    state.currentLocation = {
        name: city.name,
        country: city.country,
        lat: city.latitude,
        lon: city.longitude
    };
    
    // Save to LocalStorage cache
    localStorage.setItem('skywear_location', JSON.stringify(state.currentLocation));
    
    DOM.cityInput.value = '';
    DOM.clearSearchBtn.classList.add('hidden');
    DOM.suggestionsDropdown.classList.add('hidden');
    
    loadWeatherDataForCurrentLocation();
}

// --- 9. EVENT LISTENERS SETUP ---

function initializeEvents() {
    
    // A. Temperature Unit Toggles
    DOM.unitC.addEventListener('click', () => {
        if (state.unit === 'F') {
            state.unit = 'C';
            localStorage.setItem('skywear_unit', 'C');
            DOM.unitC.classList.add('active');
            DOM.unitF.classList.remove('active');
            updateDashboardUI();
        }
    });

    DOM.unitF.addEventListener('click', () => {
        if (state.unit === 'C') {
            state.unit = 'F';
            localStorage.setItem('skywear_unit', 'F');
            DOM.unitF.classList.add('active');
            DOM.unitC.classList.remove('active');
            updateDashboardUI();
        }
    });

    // B. Search input autocompletes with debouncing
    DOM.cityInput.addEventListener('input', (e) => {
        const val = e.target.value;
        
        if (val.length > 0) {
            DOM.clearSearchBtn.classList.remove('hidden');
        } else {
            DOM.clearSearchBtn.classList.add('hidden');
            DOM.suggestionsDropdown.classList.add('hidden');
            return;
        }

        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(async () => {
            const matches = await fetchCityCoordinates(val);
            renderSearchSuggestions(matches);
        }, 300);
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.cityInput.value = '';
        DOM.clearSearchBtn.classList.add('hidden');
        DOM.suggestionsDropdown.classList.add('hidden');
        DOM.cityInput.focus();
    });

    // Close suggestions box when clicking outside search components
    document.addEventListener('click', (e) => {
        if (!DOM.cityInput.contains(e.target) && !DOM.suggestionsDropdown.contains(e.target)) {
            DOM.suggestionsDropdown.classList.add('hidden');
        }
    });

    // Handle window resize dynamically to adjust custom SVG line coordinates
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (state.weatherData) {
                const hourly = state.weatherData.hourly;
                renderSVGChart(hourly.temperature_2m.slice(0, 12));
            }
        }, 150);
    });
}

// Render search options in drop panel
function renderSearchSuggestions(cities) {
    DOM.suggestionsDropdown.innerHTML = '';
    
    if (cities.length === 0) {
        DOM.suggestionsDropdown.innerHTML = `<div class="suggestion-item"><i data-lucide="info"></i> No matches found</div>`;
        DOM.suggestionsDropdown.classList.remove('hidden');
        lucide.createIcons();
        return;
    }
    
    cities.forEach(city => {
        const adminPart = city.admin1 ? `, ${city.admin1}` : '';
        const countryPart = city.country ? `, ${city.country}` : '';
        const itemHtml = `
            <div class="suggestion-item" data-id="${city.id}">
                <i data-lucide="map-pin"></i>
                <span><strong>${city.name}</strong>${adminPart}${countryPart}</span>
            </div>
        `;
        
        DOM.suggestionsDropdown.insertAdjacentHTML('beforeend', itemHtml);
        
        // Setup listener on newly added suggestion row
        const itemElement = DOM.suggestionsDropdown.lastElementChild;
        itemElement.addEventListener('click', () => {
            selectCity(city);
        });
    });
    
    DOM.suggestionsDropdown.classList.remove('hidden');
    lucide.createIcons();
}

// --- 10. SYSTEM STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    // Sync unit button UI state with cached preference settings
    if (state.unit === 'F') {
        DOM.unitF.classList.add('active');
        DOM.unitC.classList.remove('active');
    } else {
        DOM.unitC.classList.add('active');
        DOM.unitF.classList.remove('active');
    }

    initializeEvents();
    loadWeatherDataForCurrentLocation();
});