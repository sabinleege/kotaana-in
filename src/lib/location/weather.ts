export type Weather = { temperatureC: number; apparentC?: number; humidity?: number; precipitationMm?: number };

export async function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.searchParams.set("latitude", String(lat));
    u.searchParams.set("longitude", String(lng));
    u.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation");
    u.searchParams.set("timezone", "auto");
    const res = await fetch(u, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const d = await res.json();
    return { temperatureC: Number(d.current?.temperature_2m), apparentC: Number(d.current?.apparent_temperature), humidity: Number(d.current?.relative_humidity_2m), precipitationMm: Number(d.current?.precipitation) };
  } catch { return null; }
}

export function hydrationTargetMl(base: number, weather: Weather | null) {
  if (!weather) return base;
  let target = base;
  if (weather.temperatureC >= 30) target += 750;
  else if (weather.temperatureC >= 25) target += 500;
  if ((weather.humidity ?? 0) >= 75) target += 250;
  if ((weather.precipitationMm ?? 0) > 2) target += 100;
  return Math.min(5000, Math.max(1800, target));
}
