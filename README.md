# you-are-more-likely-to
You are more likely to get hit in the face by a toaster than get stabbed in Essex.

## 2026 revival (`web/`)

The original 2015 Tornado server (`server/`) and page (`staticpage/`) are kept for history.
The live version is in `web/` and runs on Vercel with no build step:

- `web/index.html`, `web/app.js`, `web/css.css`, `web/about.html`: the page (no jQuery).
- `web/api/fact.js`: a serverless function at `/api/fact?lat=..&lon=..` or `/api/fact?q=Chelmsford`.
  It fetches live street-level crime counts from [data.police.uk](https://data.police.uk/docs/)
  (England, Wales and Northern Ireland) and place names from [postcodes.io](https://postcodes.io/).
  Neither needs an API key.

### Deploy

Import this repo in Vercel (Add New, Project), set **Root Directory** to `web`, framework preset **Other**, and deploy.
Or from a clone: `cd web && npx vercel --prod`.
