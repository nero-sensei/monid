# Proposal: add-connector-elfa

## Why

Elfa turns crypto and markets X (Twitter) and Telegram into structured data:
analyzed events, storylines and arcs, trading calls with each caller's track
record, long/short positioning, mindshare, trending contracts and ranked
accounts. Its public API fits the connector standard as is: one base URL, one
API-key header, synchronous JSON GETs, and an exact per-call charge reported on
every response. Nothing needs a new engine capability.

It is also the first connector whose vendor dedups its own bill: a v3 list
endpoint charges a returned object only the first time the key is billed for it
within a window. The rate card is therefore an upper bound, and the vendor's
meter is the only exact source.

## What Changes

- **connectors/elfa**: 21 endpoints against `https://api.elfa.ai`, auth header
  `x-elfa-api-key`, one credit pool (`Elfa credits`).
  - v3 (13): `events`, `events/storylines`, `events/arcs`, `entities`,
    `market/{crypto,equity}/call-book`, `market/{crypto,equity}/mindshare`,
    `market/crypto/trending-contracts`, `calls`, `calls/episodes`,
    `calls/positioning`, `people/accounts`.
  - v2 (8): `aggregations/trending-tokens`, `data/top-mentions`,
    `data/keyword-mentions`, `data/event-summary`, `data/trending-narratives`,
    `data/token-news`, `aggregations/trending-cas/{twitter,telegram}`.
  - Endpoint ids keep the version segment (`elfa#v3/events`), so the two
    generations never collide and an agent can tell them apart.
- **The vendor meter settles the bill.** A provider-level `lifecycle.start`
  relays two response headers into state: `x-elfa-credits` (the total charged)
  and `x-elfa-credits-detail` (`base=1;objects=9;dedup=3` or `base=5;window=5`).
  `usage.consolidate` claims `x-elfa-credits`. Evidence reads the detail where
  it exists, so the derived fold matches the meter, dedup included, and
  `usage.mismatch` stays quiet on normal traffic. Without the headers, evidence
  falls back to counting the response and the published card settles.
- **The published card is the model.**
  - Flat `PER_CALL`: every v2 endpoint at 1 credit, except `event-summary` and
    `trending-narratives` at 5; v3 `entities` 1, `positioning` 2.
  - Base plus objects (COMPOSITE: `request` PER_CALL 1 + a `RESULT` line):
    `events` 1/event, `storylines` 2, `arcs` 2, `calls` 1, `episodes` 2 per
    position. The estimate holds `ids.length` or `limit`, so it never
    under-holds.
  - Select-one bands by `limit` (COMPOSITE of `PAGE` lines, D19): call-book 2/4,
    mindshare 5/10, trending-contracts 5/10 plus a 5-credit `long_range` line
    when `to - from` exceeds 24 hours and 5 minutes, people/accounts 5/10 by
    standing or 25/50 by track-record metrics.
- **Array params are comma-joined** in a provider `input.toRequest`, as akta
  and litescrape do. Elfa accepts both spellings, but repeated keys past 20
  values are not parsed as a list by its query parser.
- **Mirrors follow the runtime validators**, which are stricter than the
  published OpenAPI in places: v2 `timeWindow` pattern, at most five keywords,
  `page`/`pageSize`/`minMentions` at most 100; v3 ids are GUIDs, `entities.q` at
  most 128 characters, `eventType` filter without `spam`.
- **`x-elfa-credits` and `x-elfa-credits-detail` join `RECORDED_RES_HEADERS`**,
  so recorded fixtures carry the real meter.

## Capabilities

- `elfa-connector`.

## Non-goals

- v2 `chat`, `chat/stream` and `auto/*`: conversational or stateful, with a
  charge that depends on the model run. A later change can add them.
- v2 `account/smart-stats` (deprecated, scheduled for removal), `ping`,
  `key-status`, and the endpoints hidden from Elfa's published spec.
- v3 `key-status`, and `people/accounts/{handle}` (Enterprise only, not in the
  published spec).
- The x402 pay-per-request routes: the hosted platform holds an API key.

## Impact

- New: `connectors/elfa/**`, `openspec/changes/add-connector-elfa/**`.
- Modified: `shared/testing/fixtures.ts` (two allowlisted headers),
  `connectors/ids.lock.json` (21 ids).
- No schema, compiler or engine change; no version bump.

## Billing notes for the platform

- v3 charges are effective from 1 November 2026. Before that date Elfa
  reports `x-elfa-credits: 0` on v3. The engine prunes a zero
  claim, so the derived card settles; evidence still reads the detail header,
  so that card is the list price net of dedup.
- Dedup is per Elfa key. The platform key is shared by every caller, so a caller
  can benefit from another caller's earlier read.
- v2 charges its 1-credit base on some non-2xx responses after authentication
  (`event-summary` and `trending-narratives` 503s, 429s, validation errors).
  The engine zero-bills every non-2xx, so the platform absorbs those. The
  mirrors match Elfa's validators to keep paid 400s out.
- `event-summary` and `trending-narratives` run language-model work and can take
  well over a minute on a cold cache; both carry 180 s timeouts.
- Elfa rate-limits per key (60 requests per minute by default); a platform key
  should be provisioned with a higher limit.
