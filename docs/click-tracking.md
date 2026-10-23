# Web click tracking

The browser app uses CT, operated by Tearleads, LLC and hosted on Cloudflare.
Only a production build on the exact `https://rn-sandbox.a2f0.net` origin
initializes tracking, in `web/index.tsx`. Native iOS and Android entrypoints,
imported app components, development servers, previews and automated browsers
do not initialize collection.

The client queues clicks in memory and flushes them to
`https://ct.a2f0.net/v1/clicks`. Events contain a random event ID, timestamp,
element tag, site `rn-sandbox`, app `web-app`, environment `production` and
fixed page `/`. They omit text, case values, form contents, URLs, query
strings, fragments and signed-in user identity. Input fields, editable
content and elements marked `data-ct-ignore` are excluded.

The CT collector records the request IP and approximate Cloudflare
geolocation, including country, region and city when available. It does not
request GPS location. CT retains clicks for 90 days; its dashboard and data
API require an administrator login, with registration disabled and accounts
provisioned through the CLI. See the
[CT documentation](https://github.com/a2f0/ct#readme) for collector behavior.

The site owner has configured this web app to override Global Privacy
Control. Do Not Track, the CT browser extension and the site's saved CT
opt-out still prevent collection and discard queued clicks. Without the
extension, set `ct:opt-out` to `1` in this origin's local storage and reload
to opt out. Remove it to restore the default. CT adds no visitor identity
or analytics cookie.
