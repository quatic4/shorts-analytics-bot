# V2 setup

New public mode commands:
- `/add @handle`
- `/remove @handle`
- `/channels`
- `/publicstats [@handle]`

Owner mode remains:
- `/connect`
- `/analytics`
- `/today`
- `/week`

## One new Vercel env variable
Create a Google Cloud API key in the same project where YouTube Data API v3 is enabled. Add it to Vercel as `YOUTUBE_API_KEY`. Restrict the key to YouTube Data API v3 if possible.

After Vercel redeploys, re-register commands by visiting:
`https://shorts-analytics-bot.vercel.app/api/register?secret=YOUR_SETUP_SECRET`

Public mode stores snapshots in Upstash so later checks can show view/subscriber/video changes since the previous check.
