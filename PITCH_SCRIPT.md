# Video Script — Council of Ministers Briefing
### ~5 minutes · Reversa AI · Founding Engineer Challenge

---

> **Format note:** This is a screen-recorded demo with voiceover. The screen shows the live web platform throughout. Suggested pace: ~140 words per minute. Total: ~720 words.

---

## [0:00 – 0:30] Opening — The invisible problem

*(Screen: the landing page. No hero animation, no dashboard — just a single, large serif sentence on an off-white page, stating the live corpus size in deep green: "El Consejo de Ministros gobierna a ciegas un corpus de 12.045 normas.")*

"There are over twelve thousand laws in Spain.

Every year, Parliament passes new ones that quietly rewrite, repeal, or reference dozens of existing statutes — often buried in a single act. The Código Civil has been amended eighty-seven times. A single omnibus law rewrote two hundred and eighty-two different statutes in one stroke. And today, almost eighteen percent of in-force Spanish law still cites norms that no longer exist.

The statute book is broken in a way that is invisible to the people who govern it. Because nobody had ever built the graph.

Until now."

---

## [0:30 – 1:15] What this is

*(Screen: scroll down the landing page. Below the opening sentence, one short paragraph of context, then the four briefings — laid out not as cards, but as four numbered rows, 01 through 04, each showing its question, its headline figure, and a one-sentence answer, like a table of contents)*

"What you're looking at is the entire Spanish consolidated legislation corpus — twelve thousand and forty-five norms, spanning two centuries — modelled as a knowledge graph. Every amendment, every repeal, every citation is an edge in the graph.

Twenty-five thousand nodes. Fifty-four thousand relationships. Queried in milliseconds.

The platform answers four questions the Council of Ministers needs answered this week. Not as a dashboard. As a briefing — laid out like a table of contents, with the answer first, the data second, and the graph third."

---

## [1:15 – 2:00] Briefing 01 — Which laws are unreadable?

*(Screen: click into Briefing 01. The page opens with the answer itself, set in large display-serif type — not a chart, not a number tile, a sentence. Below it, the headline figure, then a quiet editorial table: thin rules, generous spacing, tabular numerals, no stripes, no chrome)*

"The first question: which laws have become unreadable?

A law amended dozens of times by different governments is no longer coherent legislation. It's a palimpsest — each layer partially contradicting the last.

The answer — what the minister reads first, in large type, before anything else — is this: the Ley del IRPF, Spain's income tax law, has been amended eighty-seven times by eighty-seven different acts. It is the most fragmented law in the country. It is the first candidate for a clean rewrite."

*(Screen: scroll to the embedded diagram below the table — small, restrained, more like a print illustration than a force-directed playground; click "Ver consulta" to reveal the underlying query)*

"Below the table, a small diagram shows its immediate neighbourhood. And if you want to see exactly how this answer was produced — the query is one click away, tucked behind a small disclosure. The minister is never shown code by default. Only the answer, and the option to verify it."

---

## [2:00 – 2:45] Briefing 02 — Who made the mess?

*(Screen: click into Briefing 02 — the same answer-first layout: large serif headline, figure, table, diagram)*

"The second question: who fabricated the disorder?

Omnibus laws — acts that silently rewrite dozens of unrelated statutes in a single stroke — are the structural cause of fragmentation. They are habitually disguised as accompanying laws to the General State Budget.

The answer: Ley 5/2017 rewrote two hundred and eighty-two distinct laws in a single act. That is a legislative grenade. The Council can restrict this practice tomorrow with a single instrument of legislative technique — and the graph tells you exactly which laws to watch."

---

## [2:45 – 3:30] Briefings 03 & 04 — The rot, and the scalpel

*(Screen: click through Briefings 03 and 04 — each opens the same way, with its answer set first in large serif type, then its table and diagram)*

"The third question reveals the rot: seventeen point six percent of in-force Spanish law — one thousand seven hundred and nine norms — invokes at least one repealed law as if it still exists. These are ghost citations. A citizen who follows the reference arrives at legal ground that no longer exists. In extreme cases, that is grounds for a legal challenge.

The fourth question gives the Council a scalpel. Ley 30/1992 was formally repealed on the second of April 2021, replaced by Leyes 39/2015 and 40/2015. Today — almost six years later — two hundred and seventy-five in-force norms still cite it directly.

This is not a policy problem. It is a worklist. Each row in this table is a concrete update task that can be assigned to a ministry. The Council can close the repeal operation with a single directive."

---

## [3:30 – 4:30] The explorer, and asking the law directly

*(Screen: navigate to Explorador. Rather than twelve thousand nodes at once, the page opens on a curated view — roughly ninety of the most connected norms, with the four laws from the briefings marked in deep green. Search for "Código Civil"; click a node)*

"Beyond the four briefings, ministers and their legal teams can explore the full graph. We don't dump twelve thousand nodes on the screen — the explorer opens on a curated view of the most connected laws, with the norms from the briefings marked so you always know where you are.

Click any law, and a panel opens beside it — styled like an encyclopaedia entry: its title in serif, its dates and status as a compact list, and every law it touches, or is touched by, written out in plain text. No buttons to press, nothing to learn. Just the law, and its relationships."

*(Screen: navigate to Preguntar — a single centred field on an otherwise empty page, with the placeholder "Pregunte al ordenamiento jurídico…")*

"And from the Preguntar page, anyone can put their own question to the graph — in Spanish.

*(Type: '¿Cuántas leyes vigentes citan la Ley 39/2015?' — the answer reveals itself word by word, like a person speaking, and only then, the query and the rows behind it, one click away)*

The answer appears the way a person would say it — and only once you've read it does the underlying query appear, for anyone who wants to check the working. No chat bubbles, no assistant persona. Just a question, and an answer, from the law itself."

---

## [4:30 – 5:00] Closing — What this is really about

*(Screen: return to the landing page)*

"Everything you've seen was built in one week, on a public API that has always been there, with data that has always been available.

Spain is not unique. Every jurisdiction with a consolidated legislation API can be mapped the same way. The graph is the layer that makes regulatory intelligence possible at scale.

This is what Reversa is building.

The statute book has been invisible for two centuries. The graph makes it legible — to the minister, to the official, to the citizen.

Thank you."

---

*Total estimated runtime: ~5 min*
*Built by Guille · Reversa AI founding engineer challenge · June 2026*
