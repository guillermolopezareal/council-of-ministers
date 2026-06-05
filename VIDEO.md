# Video Script — 5 minutes
**For the Council of Ministers. Addressed to the Vice-Presidency and the ministers responsible for legislative simplification.**

> Stage directions in *italics*. Spoken words in plain text.
> Target pace: 140 words/minute. Total run time: 5:00.

---

## [00:00 — 00:45] The problem

*Black screen. Then: the BOE homepage. Two hundred years of legislation.*

Every Tuesday, the Council meets. At some point during this mandate, someone will ask: which laws should we simplify first? And for two hundred years, the honest answer to that question has been a shrug and a binder.

Not because the information doesn't exist. It exists — every consolidated norm, every amendment, every citation, published by the Agencia Estatal Boletín Oficial del Estado, open and paginated and free. The problem is that nobody has ever read all of it at once. No single lawyer, no ministry, no directorate has held the complete Spanish statute book in their head.

12 288 consolidated norms. Two centuries of amendments. Until this week.

---

## [00:45 — 01:30] The statute book, seen for the first time

*Open the graph explorer at /explore. The graph is already loaded — blue nodes, red nodes, lines connecting them.*

This is the Spanish statute book. Each point is a law. Each line is a legal relationship — an amendment, a repeal, a citation. The graph arranged itself. We did not place any node by hand. The Código Civil is at the centre because 52 different laws have modified it since 1889. The budget laws cluster together because they modify everything around them. Old norms that have never been touched float at the edges.

*Click on the Código Civil node. The side panel opens.*

You can click on any law and see, immediately, everything it touches and everything that has touched it. This is not a static report. It is the live graph, queried against Neo4j, in real time.

*Zoom out. Return to the landing page.*

The platform pre-computes four specific answers. Let us walk through them.

---

## [01:30 — 02:15] Briefing 01 — Diagnosis: which laws are unreadable?

*Navigate to /briefings/1.*

The question: which laws have been amended so many times that they are now incomprehensible even to the lawyers who apply them?

The answer is at the top of the page, before any table.

*Point to the H1: "El Código Civil ha sido alterado 85 veces por 52 normas distintas."*

The Código Civil, from 1889, has been modified 85 times by 52 different legislative acts. No lawyer reads it in sequence. They reconstruct it, provision by provision, from a century and a third of overlapping amendments. The Código Penal comes second, with 62 modifications.

*Scroll to the table. Then scroll to the small graph below it.*

The network shows the amendment pressure on these five laws. Each line is a law that modified them. The Código Civil is not fragile — it is foundational. That is precisely why rewriting it is both the most impactful and the most politically sensitive action the Council can take.

---

## [02:15 — 03:00] Briefing 02 — Root cause: who made the mess?

*Navigate to /briefings/2.*

The question: how does a statute become unreadable? This briefing names the mechanism.

*Point to the H1.*

The Ley de Presupuestos 2023 — a single budget law — rewrote 71 distinct laws in one parliamentary session. 71 statutes, unrelated to each other, silently modified by a single annual act. This is the omnibus pattern. Budget laws, administrative reform packages, laws of "accompanying measures" — these are the instruments by which the statute book fragments year by year.

The Council does not need new legislation to address this. It needs a single technical instruction to the legislative services: no disposición final may modify a norm that is not the substantive subject of the bill. The mechanism, and its scale, are now visible.

---

## [03:00 — 03:45] Briefing 03 — The rot: how much law rests on dead ground?

*Navigate to /briefings/3. Pause on the three tiles.*

This is the briefing that surprised us most in the data. And it is the one that should concern the Council most.

*Point to the 36% tile.*

36 percent. More than one in three in-force Spanish norms cites at least one repealed law as though it still existed. 3 276 living laws — invoking legal ground that no longer exists. This is not a theoretical risk. When a citizen follows one of these citations, they arrive at a law that was abolished. When a civil servant applies a regulation that cites a non-existent norm, they are operating in legal uncertainty.

*Scroll to the ghost norms table.*

The most cited ghost is Ley 30/1992. Which brings us to the fourth briefing.

---

## [03:45 — 04:30] Briefing 04 — The worklist: the unfinished repeal

*Navigate to /briefings/4.*

In 2015, the Council repealed Ley 30/1992 — the act on the legal regime of public administrations — and replaced it with Leyes 39/2015 and 40/2015. The repeal was staged. Its final effect came into force on 2 April 2021. The cleanup was never completed.

*Point to the H1: "287 leyes en vigor siguen citando la Ley 30/1992."*

287 laws, still in force today, still cite Ley 30/1992 directly. They are not repealing it. They are invoking it as a valid legal basis for their own provisions. This table is the complete worklist. Every row is an assignment. The Council can distribute these 287 updates to the responsible ministries before the end of this mandate.

*Scroll through the table. Each row shows the ministry, the law, and the type of reference.*

This is what we mean by "closing the operation." The repeal was legislated. The cleanup is an administrative act. It just needs a list.

---

## [04:30 — 05:00] The single most surprising thing in the data

*Return to the graph explorer. Zoom out to the full corpus view.*

Everything I have shown you was knowable. The BOE data is public. The relationships are documented. The question is why nobody had computed this before.

The answer is that nobody had ever assembled the complete picture. No single ministry holds all 12 288 norms. No legal team has read all the `analisis` blocks. The statute book existed as fragments — in filing cabinets, in PDFs, in the heads of individual lawyers. It did not exist as a single object that could be questioned.

The most surprising thing in the data is not the Código Civil with 85 amendments, and it is not the Presupuestos law with 71 targets. It is the number 36.

36 percent of living Spanish law is citing foundations that no longer exist. This was not known before this week. It is not in any report. It has never been stated in this room, or any room, because no one had computed it. We built this in seven days, from public data, using a public API that has existed for years.

The information was always there. It just needed to be seen.

*Pause.*

The platform is live. The four briefings are ready. We recommend the Council begin with the Briefing 04 worklist — it is the most actionable, and it can be completed within this mandate.

*End.*

---

## Presenter notes

- **Do not narrate the technology.** The audience does not need to know the word "Neo4j" or "Python." The graph is a map; the briefings are reports.
- **On Briefing 03:** pause after "36 percent." Let the number land before explaining it.
- **On Briefing 04:** if time allows, click on one specific row in the table and show the `/norm/{id}` panel — "this is the law, this is its ministry, this is what needs to change."
- **If the API is slow:** the briefings load from memory in under 5 ms. Only the subgraph (the small network embedded in each briefing page) queries the database live. If Neo4j is responding slowly, close the briefing subgraph panel before the presentation.
- **The most important word in the script** is "seen" in the final line. Deliver it as a statement, not a pitch.
