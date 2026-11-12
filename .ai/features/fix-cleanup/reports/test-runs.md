# Test runs (summary)

## Failing first (before the fix)

### feed-ui.test.ts
       × shows one note at a time: an empty Post after a post drops the earlier success 129ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 20 passed (21)

### intros-ui.test.ts
       × stops saying 'Send Rosa this private link' once the connector had the app email her 10060ms
       × writes dates the app's way: day, then month 44ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 11 passed (13)

## Full suite after the fix (local, throwaway Postgres)

      Tests  1 failed | 3374 passed (3375)
 FAIL  src/test/deploy-setups.test.ts > every deploy setup runs the timed jobs > DigitalOcean: the template switches on the self-tick on the port the app listens on
 Test Files  1 failed | 164 passed (165)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

The one failure is the known Windows line-ending deploy test.
