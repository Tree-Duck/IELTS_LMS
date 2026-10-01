# Product

<!-- impeccable:product-schema 1 -->

> Facts marked *(inferred)* come from the codebase and project notes, not from a confirmed interview round. Confirm or correct them before a full redesign.

## Platform

web

## Users

- Primary: Vietnamese IELTS learners enrolled in the teacher's own classes (SSP IELTS), mostly targeting band 5.5–7+, practising on laptop and phone between lessons. *(inferred)*
- Secondary: the teacher, who assigns work, grades writing, reviews progress and runs class rankings.

## Product Purpose

SSP IELTS (tintinlab.com) is the class's practice platform: students do Writing, Reading, Listening and Speaking practice plus vocabulary lessons and games, and the teacher sees who is practising and where they are weak. Success = students keep practising daily between lessons and their band moves.

## Positioning

Built by a working IELTS teacher around their own 14-lesson course (Buổi 1–14): every vocabulary set, model essay and game comes from that course, not a generic question bank. Signature mechanism: "Hầm ngục chữ" — students rebuild a band-7 model essay chunk by chunk, paragraph by paragraph, choosing 1 of 3 prompts per lesson. *(inferred)*

## Operating Context

- Students log in with email or Google; classes, assignments, teacher dashboard, shared whiteboard.
- Writing Task 1 & 2 submitted for AI band scoring with criterion feedback.
- Reading & Listening timed mock tests, auto-scored and converted to band.
- Speaking Part 1·2·3 question sets with band 7–9 sample answers.
- Vocabulary: 14 lesson boxes, levels, Kiểm tra test, Flashcard / Bắn Chữ / Xây tháp / Hầm ngục chữ games, coins, shop, class rankings.

## Capabilities and Constraints

- Vanilla JS SPA; `public/` served directly by Express; no build step.
- All UI copy in Vietnamese; Vietnamese diacritics must render cleanly (no uppercase + tight tracking on diacritic text).
- Landing actions: `openAuth('login')`, `openAuth('register')`.

## Brand Commitments

- Name "SSP IELTS", domain tintinlab.com, leaf mark 🌿.
- Visual preference (confirmed 2026-10-01): clean, modern, familiar "learning app" look — white ground, one green brand colour, bold centred headline, real product UI as the proof. The teacher rejected chalkboard, photocopy, teletext and notebook directions.

## Evidence on Hand

- Real course content: 14 lessons, model essays at 3 levels, vocabulary lists (in `public/app.js`).
- No testimonials, student counts, pass rates or band-gain statistics exist. Do not fabricate them.

## Product Principles

1. Practice from the real course, not a generic bank.
2. Daily, short, visible progress beats long sessions.
3. Feedback names the exact weakness against IELTS criteria.
4. The teacher stays in the loop.
