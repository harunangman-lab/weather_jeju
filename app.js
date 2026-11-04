'use strict';

const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries(['weather-card', 'badge', 'temperature', 'condition', 'humidity', 'updated', 'weather-symbol', 'refresh', 'refresh-label', 'status', 'settings', 'api-key', 'remember', 'key-form', 'connect'].map((id) => [id, byId(id)]));
const STORAGE_KEY = 'jeju-weather-api-key';
let apiKey = '';
let loading = false;
let hasWeather = false;

function status(message, error = false) {
  ui.status.textContent = message;
  ui.status.classList.toggle('error', error);
}

function symbol(code, isDay) {
  if (code === 1000) return isDay ? '☀' : '☾';
  if (code === 1003) return isDay ? '⛅' : '☁';
  if ([1006, 1009].includes(code)) return '☁';
  if ([1030, 1135, 1147].includes(code)) return '≋';
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return '⛈';
  if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) return '❄';
  return '☂';
}

async function loadWeather() {
  if (loading) return;
  if (!apiKey) {
    ui.settings.open = true;
    status('WeatherAPI API 키를 입력한 뒤 연결하기를 눌러주세요.');
    ui['api-key'].focus();
    return;
  }
  loading = true;
  ui.refresh.disabled = true;
  ui.connect.disabled = true;
  ui['weather-card'].setAttribute('aria-busy', 'true');
  ui['refresh-label'].textContent = '불러오는 중…';
  status('제주의 현재 날씨를 불러오고 있습니다.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const url = new URL('https://api.weatherapi.com/v1/current.json');
    url.search = new URLSearchParams({ key: apiKey, q: '33.4996,126.5312', lang: 'ko', aqi: 'no' });
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('날씨 서버의 응답을 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('날씨 응답 형식이 올바르지 않습니다. 다시 시도해주세요.');
    }
    if (!response.ok || data.error) {
      const messages = { 1002: 'API 키를 입력해주세요.', 2006: 'API 키가 올바르지 않습니다. 키를 확인해주세요.', 2007: '이번 달 API 요청 한도를 초과했습니다.', 2008: '사용이 중지된 API 키입니다.', 2009: '이 API 키로는 현재 날씨를 조회할 수 없습니다.' };
      throw new Error(messages[data.error?.code] || '날씨를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    const current = data.current;
    if (!current || !Number.isFinite(current.temp_c) || !Number.isFinite(current.humidity) || typeof current.condition?.text !== 'string' || typeof current.last_updated !== 'string') {
      throw new Error('날씨 응답 형식이 올바르지 않습니다. 다시 시도해주세요.');
    }
    ui.temperature.textContent = String(current.temp_c);
    ui.humidity.textContent = `${current.humidity} %`;
    ui.condition.textContent = current.condition.text;
    ui.updated.textContent = current.last_updated;
    ui['weather-symbol'].textContent = symbol(current.condition.code, current.is_day);
    ui.badge.textContent = '현재 날씨';
    hasWeather = true;
    ui.settings.open = false;
    status('제주시 기준 날씨입니다. 새로고침으로 다시 확인하세요.');
  } catch (error) {
    ui.badge.textContent = hasWeather ? '이전 조회 결과' : '연결 실패';
    const message = error.name === 'AbortError' ? '응답 시간이 초과되었습니다. 다시 시도해주세요.' : error instanceof TypeError ? '인터넷 연결을 확인한 뒤 다시 시도해주세요.' : error.message;
    status(`${message}${hasWeather ? ' 표시된 값은 이전 조회 결과입니다.' : ''}`, true);
    ui.settings.open = true;
  } finally {
    clearTimeout(timeout);
    loading = false;
    ui.refresh.disabled = false;
    ui.connect.disabled = false;
    ui['refresh-label'].textContent = '새로고침';
    ui['weather-card'].setAttribute('aria-busy', 'false');
  }
}

ui['key-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  if (loading) return;
  apiKey = ui['api-key'].value.trim();
  if (!apiKey) { status('API 키를 입력해주세요.', true); return; }
  try {
    if (ui.remember.checked) localStorage.setItem(STORAGE_KEY, apiKey);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* 저장이 차단된 환경에서도 현재 페이지에서는 조회할 수 있습니다. */ }
  loadWeather();
});
ui.refresh.addEventListener('click', loadWeather);
ui.remember.addEventListener('change', () => {
  if (!ui.remember.checked) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* 브라우저 저장소가 차단된 경우 */ }
  }
});
try {
  apiKey = localStorage.getItem(STORAGE_KEY) || '';
  ui['api-key'].value = apiKey;
  ui.remember.checked = Boolean(apiKey);
} catch { /* 저장소가 없어도 직접 입력하여 사용할 수 있습니다. */ }
// 저장된 키가 있으면 화면이 열릴 때 자동으로 조회합니다.
loadWeather();
