# RD2L Scout

Starter build for a private RD2L scouting dashboard.

## What this version does
- Targets the RD2L EST-TUES division by default.
- Finds the active season and teams page from the division page.
- Walks each team page and collects linked RD2L player profiles.
- Opens each RD2L player profile and attempts to find the player's Dotabuff URL.
- Opens the regular Dotabuff page to collect comfort heroes.
- Opens the Dotabuff esports page to collect likely role/lane and season hero usage.
- Saves the latest scrape into Vercel Blob in production, or `data/latest.json` in local development.
- Includes a daily Vercel cron entry and a manual refresh button.

## Important honesty note
This scaffold is built from the public page structure I verified, but I could not run live network tests from the build container here. That means the parsing selectors may need a little tuning once you deploy and run the first real scrape.

The skeleton is the hard part. Small selector fixes are normal for a scraping project.

## Local setup
1. Install Node 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Environment variables
Create a `.env.local` with:

```bash
DEFAULT_DIVISION_URL=https://rd2l.gg/divisions/U-ZTEMOBg
DEFAULT_SEASON_LABEL=RD2L Season 37
CRON_SECRET=your-secret-here
SCRAPER_USER_AGENT=Mozilla/5.0 (compatible; RD2LScout/0.1; +https://your-domain.com)
```

## Deploy to Vercel
1. Create a GitHub repo and upload this project.
2. Import the repo into Vercel.
3. Add the environment variables above in the Vercel project settings.
4. Deploy.
5. After deploy, open `/api/refresh` with the `Authorization: Bearer <CRON_SECRET>` header once, or use the on-page refresh button if you leave `CRON_SECRET` empty for first boot.
6. In production, confirm your Blob store receives `cache/latest.json`. In local development, confirm `data/latest.json` gets updated.

## Recommended first improvements after first live test
- Tighten the RD2L team-page selectors to explicitly target roster rows.
- Add a better Dotabuff esports league filter using the actual league id for RD2L Season 37.
- Persist data in a real database instead of a JSON file.
- Add division selector support.
- Add comparison pages and ban suggestions.


## Required Vercel storage for production

Vercel functions cannot write to the deployed project filesystem.
To make refresh caching work in production, add Vercel Blob to the project and set:

- `BLOB_READ_WRITE_TOKEN`

In local development, the app still falls back to `data/latest.json`.
