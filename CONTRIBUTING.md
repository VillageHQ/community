# Contributing

Bug reports and pull requests are welcome. For a large change, open an issue first so we can agree on the shape.

## Run it locally

You need Node 24, pnpm and Docker.

```sh
cp .env.example .env
docker compose up -d --wait
pnpm install
pnpm dev
```

Set `SETUP_TOKEN` in `.env`, then open `http://localhost:3000/setup`.

## Before you open a pull request

```sh
docker compose exec postgres createdb -U community community_test
export TEST_DATABASE_URL=postgres://community:community@localhost:5432/community_test
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

The tests wipe that database. They run against fake Village and Resend servers, so you don't need any keys. `src/test/village-recorded-responses.ts` holds the shapes Village really sends. If Village changes, update it and the fake together.

## Guidelines

- Write screens for someone who has never used a terminal. Say what to do next, with no jargon.
- Test behavior, and add a test for each bug you fix.
- Never commit keys, real people's data or anything from a real community.

By contributing, you agree that your work is licensed under the [GNU Affero General Public License v3.0](LICENSE), and that Village may also release it under other licences, including more permissive ones such as MIT. This keeps the project able to change its licence later as one whole.
