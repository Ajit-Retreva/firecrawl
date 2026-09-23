# Firecrawl on this Mac

This fork starts from Firecrawl v2.11.162 (commit
`7666c1f9ae8720a6bba271e0f60b6a217f8a5210`). It adds local Playwright
screenshots and page actions, a persistent Docker Compose configuration,
SearXNG search, and an Ollama routing fix. It is not full Firecrawl Cloud parity.
Upstream license and notices remain in this repository.

## Start and stop

The Mac setup uses Homebrew's Colima, Docker, Docker Compose, Docker Buildx,
and Ollama. On a new Mac install these first:

```sh
brew install colima docker docker-compose docker-buildx ollama
colima start --cpu 6 --memory 16 --disk 80 --vm-type vz
brew services start ollama
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

Register `/opt/homebrew/lib/docker/cli-plugins` in Docker's
`cliPluginsExtraDirs` setting if Buildx is not discovered. Then, from this repo:

```sh
./local.sh setup
./local.sh start
./local.sh status
./local.sh test --ai
./local.sh logs api
./local.sh stop
```

The API listens at **http://127.0.0.1:3002** without an API key. Only the API
port is published, bound to loopback. PostgreSQL, Redis, RabbitMQ, SearXNG,
and the browser service stay inside Docker's network. `stop` retains data
volumes; do not use `down -v` unless you intend to delete stored jobs.
Completed results still follow upstream retention/expiry rules.

`local/.env` contains generated local database credentials and is gitignored.
Ollama runs on the Mac to use Apple Silicon acceleration; containers reach it
through Colima's `host.lima.internal`. Other Docker runtimes need a different
host address. The VM does not automatically restart at login; run `colima start`
after a reboot. Ollama does restart at login through Homebrew services.

## Point an existing client here

Replace the hosted API base URL with `http://127.0.0.1:3002`, keeping the
existing `/v1` or `/v2` endpoint suffix. Do not send a paid Firecrawl key.
Some SDK versions still require a nonempty key argument; a dummy local value
is sufficient. Existing projects have not been switched automatically.

```sh
curl http://127.0.0.1:3002/v2/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown","screenshot"]}'
```

Supported actions: `wait` (selector or milliseconds), `click` (including
`all`), `write` to the focused element, `press`, `scroll` (page or selector),
`scrape`, `screenshot`, `executeJavascript`, and `pdf`.
`executeJavascript` accepts a function body, for example `return document.title`.
Actions run in an isolated Chromium page with the existing network checks.
The request timeout closes the context if navigation, an action, or script hangs.

Screenshots and generated PDFs are returned as **base64 data URLs**, not hosted
download links. Screenshots use PNG by default and JPEG when `quality` is set.
`fullPage` and custom `viewport` are supported. Decode data URLs to save files.
Large screenshots increase API response and queue-storage sizes.

## Features and remaining gaps

| Capability | Local implementation / limits |
| --- | --- |
| Markdown, HTML, links, JavaScript rendering | Upstream fetch and Playwright |
| Crawl, batch scrape, job polling | Upstream queues; local persistent volumes |
| Site map | Upstream sitemap discovery; no managed web index; sites without sitemaps can return an empty map |
| Web search | Local SearXNG querying public engines; can be rate limited |
| Screenshots and page actions | Added to Playwright in this fork |
| JSON/schema extraction | Ollama Qwen2.5 7B; model quality and speed differ from cloud |
| PDF generation | Added browser `pdf` action; distinct from parsing source PDFs |
| Source PDF/document parsing | Existing upstream paths, not all specialized parsers supplied |
| Proxies, anti-bot, CAPTCHA handling | No managed proxy pool or proprietary Fire-engine; protected sites may fail |
| Cloud Agent, persistent Browser/Interact sessions | Not implemented; page actions last for one scrape |
| Managed dashboard, enterprise controls, specialized media formats | Not implemented |

No Firecrawl subscription or paid model credentials are configured. This still
uses your Mac's compute, disk, electricity, and internet. It cannot guarantee
the hosted service's throughput or success rate. Start at three concurrent
scrapes, measure actual target sites, then adjust the local Compose settings.
Search is internet search through a local service, not an offline web index.

## Tests

Browser regression tests use a local fixture and real Chromium:

```sh
cd apps/playwright-service-ts
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
pnpm exec tsx --test local-features.spec.ts
```

The root `./local.sh test --ai` checks v1/v2 scraping, browser action results,
PNG output, search, sitemap mapping, queued crawling/batch scraping, and structured extraction through the API.
There is also a self-hosted API snip in
`apps/api/src/__tests__/snips/v2/scrape-local-browser.test.ts`.

Verified on Apple Silicon with 48 GB RAM: both Docker images compile; four
real-browser tests and two API snips pass; v1/v2 scraping, search, sitemap
mapping, crawling, batch scraping, and Ollama JSON extraction pass. A completed
two-document batch remains available after destroying and recreating all
service containers with their data volumes retained. These are functional
checks, not a large-project throughput benchmark. Search returned results via
Bing while DuckDuckGo reported a CAPTCHA during validation.

References: [upstream self-hosting guide](https://docs.firecrawl.dev/contributing/self-host),
[cloud comparison](https://docs.firecrawl.dev/contributing/open-source-or-cloud),
[Qwen2.5 model](https://ollama.com/library/qwen2.5:7b).
