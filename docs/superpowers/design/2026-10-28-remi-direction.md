# Remi v1 design direction

Date: 2026-10-28. Status: **Catalog** locked; comps captured in [comps](comps/); production UI not built.

Product truth: [PRODUCT.md](../../../PRODUCT.md). Scope: library, desktop editor, mobile editor,
export flow, plus empty/loading/error/saving states. Mode: **Operate**. Scene: laptop and phone
used equally, usually one card in a short sitting; the interface must never read as a fan wiki or
merch shop, a corporate SaaS dashboard, a retro arcade, or a generated template.

The mechanism every direction must carry: a full-bleed card of real media artwork, addressed by
numbered slots, edited by pressing rather than dragging, with save and export state always legible.

## Grounded worlds, ordered by resonance

| #   | World                             | Why it can carry the mechanism                                                              |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Film-archive index cards          | Saved cards are index cards; typed metadata is the honest chrome for titles and providers.  |
| 2   | Broadcast program guide           | The grid already is a schedule of media cells; channel and time become category and slot.   |
| 3   | Collector binder pages            | The 3×3/4×4/5×5 card is a pocket page; slots are physical pockets.                          |
| 4   | Risograph zine                    | Two-ink print discipline keeps chrome quiet so artwork owns colour.                         |
| 5   | Cinema lightbox / poster wall     | Artwork-led by construction; one-sheets are the content.                                    |
| 6   | Book obi and packaging bands      | Tight typographic bands and colophon details make metadata feel designed, not systemy.      |
| 7   | Media console and numbered keypad | Direct slot addressing answers the no-drag requirement; the card is what the console plays. |

## Roll

Seed `7fa436db` assigned index 7: **media console**. Six catalog challengers were fused with the
product and weighed on audience identification and product clarity.

| Challenger                  | Verdict     | What the direction keeps                                                                    |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Variable-font specimen      | declined    | Continuous direct response: every control updates the card in place, no apply step.         |
| Cassette j-card             | declined    | One-sheet completeness: card, queue, and controls read on one plane.                        |
| Star atlas                  | declined    | Notational hierarchy: slot numbers and labels stay legible at 5×5 density.                  |
| Design annual plate section | competitive | Registration furniture: hairline rules, corner marks, mono plate numbers.                   |
| Doujin event catalog        | wins        | Numbered grid ↔ hall-map correspondence: slot numbers are the selection surface.            |
| Botanical folio             | declined    | Fixed-scale comparison: switching format compares at one scale, never rescales composition. |

The catalog wins both axes: its grid of small drawings is the product's actual object, and its
numbered hall map is the slot system. It therefore becomes the build candidate, presented below
as Direction B. The assigned console direction remains the lead card, raised by the disciplines it
lost to.

## Direction A — Console (assigned)

**THESIS.** A card is programming you tune, not a form you fill. The category default (grey sidebar,
generic form fields, artwork reduced to thumbnails) is refused.

**OWN-WORLD.** Anodized graphite panel (#15171A), bone type (#EDE7DC), a single amber readout
(#E8A33D); soft-touch keys with engraved 1px rules, no glow, no gradients. Type: a tight grotesque
for the readout, tabular figures for slot numbers.

**STORY.** Scan the wall, press a slot number, watch the card answer; saving reads as deck status,
not a toast.

**FIRST VIEWPORT.** Card centre at full height; narrow left rail of numbered keys; one readout line
for title, format, and save state. Mobile: the same keys become a bottom keypad under a pinned
preview, Export always reachable.

**RAISES.** Registration furniture (design annual): slot indices drawn as corner marks. One-sheet
completeness (cassette): no modal sprawl for arrange or style. Notation hierarchy (star atlas):
codes and captions rank by size before colour. Direct response (specimen): every control is live.

**RISK.** A console is one step from retro hardware; the world only works if the panel stays quiet
and the card does the talking. Dark-only is a real limitation for daylight phone use.

## Direction B — Catalog (winning challenger; build candidate)

**THESIS.** The card is a convention catalog page: a numbered grid of artwork you circle and
rearrange, not a dashboard. Refuses the media-app grid of cards on a dark background.

**OWN-WORLD.** Newsprint ground (#F1EEE4), ink (#171512), one spot red (#C23B22) reserved for
selection, slot codes, and the save dot — never decoration. 1px rules, mono catalog codes at
11px/0.14em, photos untinted. Type: one grotesque across display and caption; tabular figures.

**STORY.** Find the work, circle it, give it a slot; the numbered margin is both map and control.
The library is a stack of past catalog sheets; the editor is the current sheet.

**FIRST VIEWPORT.** Full-bleed sheet: the card is the main plate, slot numbers sit in the margin
like table codes, the left index column carries Add/Arrange/Style, and the spot-red ring marks the
selected cell. Export sits at the sheet's foot as a stamped action. Mobile: the sheet fills the
viewport, the index column becomes Preview/Add/Arrange/Style tabs, Export pinned.

**RAISES.** Registration furniture (design annual): crosshairs and hairlines register each plate.
Direct response (specimen): every control repaints the sheet immediately. Fixed-scale comparison
(botanical): formats compared at one width. One-sheet completeness (cassette): no separate arrange
screen; the sheet is the workspace.

**RISK.** Newsprint texture and codes can crowd artwork at 5×5; the sheet must stay quiet enough
that posters remain the only saturated field. Print nostalgia can tip into kitsch if the red is
used as decoration.

## Direction C — Archive (pick)

**THESIS.** Each saved card is an index card in a drawer; the editor is that card on a light table.

**OWN-WORLD.** Manila (#E7DCC3), typewriter ink (#26221C), an oxblood stamp (#7A2E2A); ruled lines,
tab dividers, edge notches. Type: a workhorse text face with typewritten metadata.

**STORY.** Pull a card, stamp it, file it. The library is the drawer; search is the index.

**RISK.** The archival look is familiar editorial territory and reads older than the audience; the
metaphor is strongest in the library and weakest in the full-screen editor.

## Standing exit

The category standard — a neutral dark workspace with a large preview, a left tool rail, and a
bottom action bar — is available without irony. It is the familiar path, not the recommended one.

## Decision

Locked: **Direction B — Catalog**. Comps cover the library, desktop editor, mobile editor, export,
and the empty/loading/error/saving states with a populated 5×5 card and long CJK/Latin titles.
The durable system is recorded in [DESIGN.md](../../../DESIGN.md).
