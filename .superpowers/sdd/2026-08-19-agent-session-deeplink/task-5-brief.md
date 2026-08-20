### Task 5: Gates and baseline comparison

**Files:**
- No source changes expected. Any fix this task uncovers is committed here.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the verification record quoted back to the user.

- [ ] **Step 1: Typecheck**

Run: `pnpm exec vue-tsc --noEmit`
Expected: no errors. Most likely failure mode is `urlQuery.value.session` being `LocationQueryValueRaw` where a `string` is wanted — fix by keeping the `.toString()` conversions shown in Tasks 1-3 rather than widening any type.

- [ ] **Step 2: Run the full suite**

Run: `pnpm test > /tmp/after.txt 2>&1; tail -20 /tmp/after.txt`
Expected: the failure set is unchanged from the baseline in Global Constraints — still 5 failed files / 4 failed tests, all of them the pre-existing `timezone` / `photosSlice` family, and the counts of passing tests grew by the tests added here.

- [ ] **Step 3: Report honestly**

State the before/after failure counts and name the pre-existing failures explicitly. If any new failure appeared, fix it and re-run rather than reporting "green".

- [ ] **Step 4: Commit anything Step 1-3 required**

```bash
git commit -s -am "fix(ai): <what the gate caught>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Skip this step if the gates were clean.
