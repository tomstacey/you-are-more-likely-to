// Vercel serverless function: GET /api/fact?lat=..&lon=..  or  /api/fact?q=Chelmsford
// Modern replacement for the 2015 Tornado server in /server. It uses live street-level
// crime data from data.police.uk and place names from postcodes.io (both free, no API key).

// "1 in N" odds, from the original "Stupid Statistics" file.
const FACTS = [
  [1818, "fall down stairs and be killed"],
  [3748067, "be killed by a shark"],
  [173871, "be killed by cows"],
  [479992, "be killed by fireworks"],
  [4238, "die by ground floor slippage"],
  [4147, "be in a fatal bicycle accident"],
  [435000, "be killed by tobacco smoking"],
  [43000, "be involved in a fatal car accident"],
  [300000000, "die from a scorpion sting"],
  [65000, "die by simply falling over in the shower"],
  [5486, "be killed by a fall from a high place"],
  [4700000, "be killed in a single airline flight"],
  [5862, "die in an air crash"],
  [5000, "come first on Rainbow Road"],
];

// The original scaled each fact against the rarest one, and each area's crime count
// against the busiest area in its data set. The street-crime API caps a search at
// 10,000 crimes, so that cap stands in for "the busiest area".
const RAREST = Math.max(...FACTS.map(([n]) => n));
const BUSIEST = 10000;

const UA = { "User-Agent": "you-are-more-likely-to (hackathon revival)" };

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status} from ${url}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

// Text search -> { lat, lon, region }
async function geocode(q) {
  q = q.trim();
  if (POSTCODE.test(q)) {
    const { result } = await getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
    return { lat: result.latitude, lon: result.longitude, region: result.admin_ward || result.admin_district || q.toUpperCase() };
  }
  if (OUTCODE.test(q)) {
    try {
      const { result } = await getJson(`https://api.postcodes.io/outcodes/${encodeURIComponent(q)}`);
      return { lat: result.latitude, lon: result.longitude, region: (result.admin_district && result.admin_district[0]) || q.toUpperCase() };
    } catch (e) { /* fall through to place search */ }
  }
  const { result } = await getJson(`https://api.postcodes.io/places?limit=1&q=${encodeURIComponent(q)}`);
  if (!result || !result.length) return null;
  return { lat: result[0].latitude, lon: result[0].longitude, region: result[0].name_1 };
}

// Coordinates -> place name (best effort)
async function placeName(lat, lon) {
  try {
    const { result } = await getJson(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1&radius=2000`);
    if (result && result.length) return result[0].admin_ward || result[0].admin_district;
  } catch (e) { /* ignore */ }
  return null;
}

// Crimes within roughly a mile of the point, for the latest month published.
async function crimesNear(lat, lon) {
  try {
    const crimes = await getJson(`https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lon}`);
    return { count: crimes.length, month: crimes.length ? crimes[0].month : null, street: crimes.length ? crimes[0].location.street.name : null };
  } catch (e) {
    if (e.status === 503) return { count: BUSIEST, capped: true, month: null }; // over 10,000 crimes
    if (e.status === 404) return null; // outside police.uk coverage (e.g. Scotland)
    throw e;
  }
}

function pickFact(count) {
  const crimerate = 100 * Math.min(count, BUSIEST) / BUSIEST;
  const options = FACTS.map(([n, fact]) => ({ fact, chance: 100 * n / RAREST, n }))
    .map((f) => ({ ...f, timesmorelikely: crimerate / f.chance }))
    .filter((f) => f.timesmorelikely >= 2);
  const pool = options.length ? options : [{ fact: FACTS[0][1], n: FACTS[0][0], timesmorelikely: 2 }];
  const f = pool[Math.floor(Math.random() * pool.length)];
  return { fact: f.fact, odds: f.n, timesmorelikely: f.timesmorelikely, crimerate };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    const { lat: latS, lon: lonS, q } = req.query;
    let lat = parseFloat(latS), lon = parseFloat(lonS), region = null;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      region = await placeName(lat, lon);
    } else if (q && q.trim()) {
      const g = await geocode(q).catch(() => null);
      if (!g) return res.status(200).send(JSON.stringify({ error: true, reason: "place-not-found" }));
      ({ lat, lon, region } = g);
    } else {
      return res.status(400).send(JSON.stringify({ error: true, reason: "need lat/lon or q" }));
    }

    const crimes = await crimesNear(lat, lon);
    if (!crimes || crimes.count === 0) {
      return res.status(200).send(JSON.stringify({ error: true, reason: "no-crime-data", region }));
    }

    const f = pickFact(crimes.count);
    return res.status(200).send(JSON.stringify({
      error: false,
      region: region || crimes.street || "your area",
      fact: f.fact,
      odds: f.odds,
      timesmorelikely: f.timesmorelikely,
      crimerate: f.crimerate,
      recentcount: crimes.count,
      capped: !!crimes.capped,
      month: crimes.month,
    }));
  } catch (e) {
    console.error(e);
    return res.status(502).send(JSON.stringify({ error: true, reason: "upstream-failed" }));
  }
};
