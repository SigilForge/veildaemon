# Creator Rights Verification Projection Ops

The public static registry does not read Supabase at request time. Current
verification state must be exported through a trusted server/build step.

Authority flow:

```text
creator_rights_verification_evidence
  -> rights/verification-projection.json
  -> rights/*.json
  -> static rights pages
  -> registry/records.json
```

The browser and generated HTML are consumers, not authorities.

## Normal Live Export

1. Apply all VeilLink migrations, including
   `veillink/supabase/migrations/20260728193000_creator_rights_verification.sql`.
2. Confirm Supabase REST can see `creator_rights_verification_evidence`.
3. Run `npm run rights:verification:export`.
4. Run `npm run rights:verification:release-check`.
5. Run `npm run rights:render`.
6. Run `npm run rights:index`.
7. Run `npm run rights:validate`.
8. Run `npm run rights:index:check`.
9. Scan public artifacts for private verifier material:

   ```bash
   rg -n "challenge=|token_hash|SUPABASE_SERVICE_ROLE_KEY|Bearer |service_role" rights registry studio
   ```

10. Run Creator Rights browser coverage.
11. Deploy the static public surface.

## Local Bootstrap

Use `npm run rights:verification:sync-local` only for local development or
pre-migration bootstrap. It writes `projectionMode: "local_bootstrap"` so it
cannot be mistaken for current live verification state.

Release checks must use `npm run rights:verification:release-check`, which
requires `projectionMode: "live"` and a projection generated within 24 hours.

## Expected Missing-Migration Failure

If the verifier migration has not reached the target project, live export fails
with a Supabase REST error similar to:

```text
Could not find the table 'public.creator_rights_verification_evidence' in the schema cache
```

That means the export pipeline reached Supabase correctly, but the target
database is not ready. Apply the migration and wait for schema cache visibility
before retrying.

## Trust Boundary

The projection is jurisdiction-neutral. It records public-safe evidence and the
bounded claim statement only. It must not grow California, Washington, EU, or
other jurisdiction-specific compliance fields. Those belong in separate
compliance views derived from the canonical rights record plus verification
projection.

Do not add signatures until there is a defined signing authority and
key-management policy.
