# Suther's Cup #34 — combined, changes-only update (31 October 2026)

This ZIP **replaces the earlier, not-yet-published tie-break/full-name update** and includes the new top-eight qualification forecast. Apply this one ZIP rather than publishing the two versions separately.

## Critical: safeguard your current round-robin scores

1. On the device used for scoring, while **Scoring mode ON**, select **Backup JSON**. Save the downloaded `edition34.json` somewhere outside the browser (for example, Files or OneDrive). Confirm it includes your entered results.
2. In your GitHub repository, separately download a copy of the currently published `data/edition34.json` (if it exists and has results). Keep the two copies clearly named in your private backup folder. **Do not change player IDs or edit the winner fields.**
3. **Do NOT replace, remove, upload or commit `data/edition34.json` when installing this code update.** This changes-only ZIP intentionally contains NO JSON results file.
4. Upload the files listed below to the root of your *existing* website repository, then commit them **together**. If GitHub asks to overwrite `index.html`, choose to replace it; the other JS/CSS files are new versioned files.
5. Refresh the live site. The Edition #34 fixtures and existing published results should appear. On the scoring device, remain in or resume scoring mode; your locally saved results should still appear. **Check the number of results before recording additional scores.** If your browser storage has been lost, use **Restore** and select the JSON backup you made in Step 1.
6. Publish a new results update as before: on the official scoring device, use **Backup JSON** and replace only `data/edition34.json` in GitHub with *that newest export*. The public website updates after GitHub Pages deploys; spectators may tap **Refresh scores**.

## Files to upload

| File | Action |
|---|---|
| `index.html` | Replace the existing root HTML file. |
| `app-20261031-forecast.js` | Add to the repository root; includes the earlier tie-break and full-name functionality plus the player forecast. |
| `tournament-core-20261031-forecast.js` | Add to the repository root; includes all earlier ranking and McIntyre logic plus simulations. |
| `edition34-tiebreak-20261031.css` | Add to the root (same styling as earlier pending tie-break update). |
| `edition34-forecast-20261031.css` | Add to the root for forecast panel and separate Developer rules styling. |

Do not upload this installation document as a site asset unless you want to. The older `app.js`, `tournament-core.js`, `app-20261030-live.js` and `tournament-core-20261030-live.js` may remain in the repository; the new `index.html` points specifically to the matching, versioned files, avoiding stale-cache incompatibility.

**Dependencies unchanged:** `styles.css`, `history.js`, `edition34-fixtures-20261030.js`, `edition34-live-20261030.css`, `assets/`, and `data/history.json` should already be present from your official 11-player site. If they are missing, first install the earlier official-11-player package before this changes-only patch.

## New qualification forecasts

Once a player is selected under **Edition #34 > Fixtures & scores**, the page shows:
- **Confirmed top 8** / **Confirmed outside top 8** when a conservative mathematical guarantee can be proven (or official rankings are final).
- **Likely top 8** (estimated chance at least 82%), **Borderline** (above 18%, below 82%), or **Likely outside top 8** (18% or below) otherwise.
- Estimated qualification percentage, expected final wins, projected eighth-place cut line, additional wins required to reach that line, and estimated win chances against unplayed opponents.
- Where supported by enough simulated outcomes, an indicative target for an estimated 70% qualification chance; a separate mathematically sufficient clinching target is shown only when derivable.

The forecast uses **2,400 deterministic, opponent-adjusted simulations**, preserving all entered results and following the full official tie-break system (modelling unresolved RPS as fair decisions for forecasting purposes). These are **estimates, not guarantees**. Only “Confirmed” is mathematically certain. Read the detailed method under **Cup Rules > Developer Rules > Top-eight qualification forecasts**.

## Historic rules and tie-breaks

The original March 2011 house rules remain Sections 01–08. The previously supplied 2026 tournament seeding/tie-break rules have moved to the new, clearly separate **Developer Rules** section; the new qualification prediction method sits beside them. The fixed 44 fixtures, short player names on match cards, 11-player mapping to full names in the Hall of Fame, eight qualifiers, nine-match McIntyre finals, first-to-three RPS decider and public JSON publishing flow are unchanged.

## Compatibility, testing and limitations

- Uses the **same** browser storage key: `suthers-cup-edition-34-official-11-v2`.
- Uses the **same** exported JSON schema, with no mandatory new properties. Predictions are calculated in memory and **never written to the JSON**.
- Tested with a 17-result previous-format snapshot, entering an eighteenth result, exporting the exact round-robin records, all 44 completed results, nine McIntyre finals, full-name champion listing, and 1440px / 768px / 390px / 320px viewport widths.
- This code patch has **not** been installed on your actual GitHub repository. A real deployment / cache check remains necessary.
- Probabilities are model-dependent and do not account for strategic play, injuries, drink consumption, or other off-table factors. Mathematical confirmations use conservative bounds; a player might be mathematically secure before the interface can prove that status, but **no one is labelled confirmed without proof**.
