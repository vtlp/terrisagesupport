
## Fix the repeating onboarding RLS failure at the real root

### What is actually happening
The repeat error is no longer coming from the notification or activity-log triggers.

The strongest clue is this:
- a fresh `onboarding_submissions` row was inserted successfully with `enquiry_id = null`
- the failing user flow is a linked onboarding form, which sends a real `enquiry_id`

That means the base insert path now works, but the linked insert still fails. The likely blocker is the foreign-key + RLS interaction on `enquiries`:
- `onboarding_submissions.enquiry_id` references `public.enquiries(id)`
- `enquiries` only has a staff-only RLS policy
- public onboarding users cannot see the parent enquiry row
- when the linked submission tries to insert, the database cannot validate that foreign-key target under the current anonymous role, so the insert is rejected and bubbles up as an RLS failure on `onboarding_submissions`

### Implementation plan

#### 1. Stop inserting linked onboarding rows directly from the public client
Replace the public client-side `.from("onboarding_submissions").insert(...)` flow with a dedicated `SECURITY DEFINER` database function, for example:

```sql
public.submit_onboarding_public(
  _tenancy_type public.tenancy_type,
  _payload jsonb,
  _enquiry_id uuid
)
```

What that function will do:
- validate the enquiry link safely on the server
- call `check_submission_lock(_enquiry_id)` before insert
- insert into `public.onboarding_submissions` using definer privileges
- return the new submission id / submitted timestamp
- raise a clear exception if the link is already locked

This avoids exposing `enquiries` to anonymous users and removes FK/RLS friction from the public browser path.

#### 2. Keep `enquiries` private
Do not add broad anonymous `SELECT` access to `public.enquiries`.

That table contains contact data and should stay staff-only. The secure function above is the right abstraction because it:
- validates the link server-side
- preserves privacy
- avoids weakening RLS on a PII table

#### 3. Update the frontend submit flow to call the RPC
In `src/lib/onboardingSubmit.ts`:
- replace the direct `.insert(...)` with `supabase.rpc("submit_onboarding_public", ...)`
- map known database errors into friendly UI messages:
  - already submitted
  - invalid or expired onboarding link
  - generic submission failure

This keeps the public forms working without changing the rest of the form payload logic.

#### 4. Preserve the existing trigger-based staff side-effects
Keep the existing triggers in place:
- `trg_notify_submission`
- `trg_submissions_activity`

Those were sensible fixes, and they should continue to run after the secure insert function writes the row.

#### 5. Add one more hardening pass around linked submissions
Inside the new function:
- reject blank payloads
- allow `null` enquiry ids only if that is still a valid public fallback path
- if linked flow is expected, verify the enquiry exists before insert
- return a deterministic error message instead of raw database text

#### 6. Verify the full end-to-end paths
After implementation, test both cases:
1. Public onboarding with a valid `enquiry_id`
2. Public onboarding without an `enquiry_id`

Expected results:
- linked submission inserts successfully
- staff can still review the submission from the enquiry screen
- notification and activity entries still get created
- duplicate submission attempts show the friendly “already submitted” message

### Files to change
- `src/lib/onboardingSubmit.ts` — switch public submission to RPC
- `supabase/migrations/...sql` — create `submit_onboarding_public(...)` function and grant execute to `anon, authenticated`

### Technical notes
- No change to the `onboarding_submissions` table structure is needed
- No broad public policy should be added to `enquiries`
- This is a security-preserving fix, not a permission-broadening fix
- The earlier trigger changes can remain; they were not the final root cause, but they are still useful for server-side inserts

### Why this is the right fix
A real-user linked onboarding form needs to reference a private enquiry without making that enquiry publicly readable. The correct pattern is:
```text
Public form -> secure backend function -> validated insert -> normal staff review flow
```

That solves the repeating error at the correct layer instead of continuing to patch downstream trigger symptoms.
