# Friends live check

Run this on the published page on claude.ai. You need three people: the owner (O) and two Contributors (A and B), each signed in on their own device or browser profile. Every step is done in the Friends tab (hub tab 9). Allow a few seconds for changes to show up on the other screen.

## 1. Setup
1. O shares the page with A and B as Contributors.
2. A and B each open the page and go to Friends.
   - Pass: both see "Challenges", "Friends" and "Your progress card".
   - Fail: "View-only access" (wrong sharing level), or "This browser can't encrypt…" (an old browser, or not on claude.ai).

## 2. Friend codes
1. A clicks "Make my code" and sends the code to B.
2. B types it into "Friend code" (any case, with or without the dash) and clicks Add.
   - Pass: A appears in B's Friends list, and a "Following …" note pops up with A's name.
   - Fail: "No gardener has that code", or someone else gets added.

## 3. One-way follow
1. B now follows A, but A doesn't follow B. Both switch on "Share my progress with people I follow".
   - Pass: B's row for A says "Hasn't added you back. Only people they follow see their progress." with no stats.
   - Fail: B sees A's stars, or the row is blank or stuck on "Loading card…" for more than about 10 seconds.

## 4. Mutual cards, and the late-card case
1. A adds B (search their name, or use B's code). Have B watch their screen while A does this.
   - Pass: within about 2 seconds, B's row for A shows A's stars, plots and the world bars, and the line says "Shares with you · played today". A's status line reads "Shared with 1 person you follow".
   - Fail: B still sees "Hasn't added you back" after 5 seconds.
2. Late card: A follows someone new and reloads the page straight away, within a second.
   - Pass: after the reload, that person sees A's card within a few seconds.
   - Fail: they only see it after A changes something or waits a minute.

## 5. Safety codes
1. A clicks the lock button on B's row, and B does the same on A's row.
   - Pass: both screens show the same 12 digits ("1234 5678 9012"). Compare them over a call or chat.
   - Fail: the digits differ. Stop and check that each of you really has the right person.
2. A clicks "Mark as verified".
   - Pass: a small "verified" badge appears next to B's name, and it's still there after a reload.

## 6. Challenge and nectar
1. Note A's and B's nectar in the top bar.
2. A clicks Challenge on B's row, picks a sky and clicks "Play it first", then wins the sky.
   - Pass: the result says "Challenge sent". A's nectar goes up by 5 (only for the first 3 challenge results each day).
3. B sees a badge on the Friends tab and the challenge under "For you". B clicks Play and wins.
   - Pass: B's nectar goes up by 5. The result screen shows the winner. A's "Recent challenges" updates on its own.
   - Fail: B never sees the challenge, nectar goes up twice for one result, or the two players see different winners.

## 7. The owner can't read cards or challenges
Do this as O. O doesn't need to follow anyone.
1. Ask Claude, with access to this artifact's data, to list the documents in `cards`, `chal` and `keys` and say what they contain.
   - Pass:
     - `cards/<id>` has only `v`, `u`, `at` and `w`. Each wrap in `w` is a random-looking `iv`/`ct` pair.
     - `chal/<id>` has only `v`, `u`, `at`, `out` and `res`, with `t`/`iv`/`ct`/`k` entries.
     - No stars, seeds, results or user ids appear anywhere except the doc's own `u`.
     - Nothing under `data/users/...` shows up for O.
   - Fail: any readable stats, seeds, `to`/`from` arrays or other players' ids.
2. Also as O: O's own Friends tab shows none of A's or B's challenges, and no card from A or B.

## 8. Swapped key (optional, owner only)
1. Ask Claude to overwrite `keys/<B's id>` with any other valid P-256 public key, while B has the page closed.
   - Pass: A's row for B says "Sharing with them is paused" and "Their key changed since you verified them. Compare safety codes, then accept." A's card and challenges stop going to B.
2. B opens the page.
   - Pass: B sees "Your shared key was replaced by someone else and has been restored." A's warning clears by itself, the verified badge returns, and sharing resumes.
   - If A clicked "Accept new key" on the swapped key before B came back, A sees the warning again. A must compare codes with B and accept B's real key. The verified badge then stays off until A marks it again.
   - Fail: A keeps sharing with the swapped key without any warning.
