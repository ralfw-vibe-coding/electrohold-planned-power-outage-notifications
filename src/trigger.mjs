// Startet die Hintergrundfunktion /api/job (zeitgesteuerte Funktionen dürfen selbst nur 30 s laufen).
export async function trigger(what) {
  const base = process.env.URL || "https://erm-zapad-planned-power-outages.netlify.app";
  const res = await fetch(`${base}/api/job?what=${what}`, { method: "POST", headers: { "x-admin-token": process.env.ADMIN_TOKEN || "" } });
  console.log(`job ${what}: HTTP ${res.status}`);
}
