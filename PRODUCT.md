# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + Tailwind. Confirmed by the user on 2026-09-02.

## Users

Primary: newly elected university club officers (president, vice president, treasurer, training lead). They open a laptop to see what to do this week. Not general members.

## Product Purpose

UniClub turns last year’s operating manual into an officer board: this week’s work, the next event countdown, and next week’s work. Success is seeing “what to do now” on the first screen.

## Positioning

A shared officer ops board derived from a club manual, not a chat app, member SNS, or analytics dashboard.

## Operating Context

Officers still announce in KakaoTalk. This board is the source of dates, D-Day work, and rules. Demo data is the 2026 OceanHolic club extract. v1 is a single shared board (no login).

## Capabilities and Constraints

- v1 home matches `디자인 틀2.png`: logo + menu, event D-Day, this-week tasks, next-week tasks.
- No role filters in v1. No login. No payments. No Kakao integration.
- Task checkboxes are local only.
- Event D-Day is the nearest upcoming event, not per-task countdown. Task D-Day stays on each row.
- Genre-agnostic chrome: do not hardcode scuba styling into the shell.
- PC-first. Phone must not break.

## Brand Commitments

- Product name: UniClub.
- Visual constraints volunteered by the user: quiet tool UI (not a landing page), no glass, no charts, no neon. Wireframe `디자인 틀2.png` is the layout authority. Skills: impeccable Operate, minimalist-ui, ui-styling, ui-ux-pro-max.

## Evidence on Hand

- `OceanHolic_운영매뉴얼.md` — source manual.
- `OceanHolic_extracted.json` — v1 seed data.
- `UniClub_JSON.json` — schema.
- `UniClub_PRD.md` — product scope.
- `디자인 틀2.png` — home layout.

Do not invent member names, real phone numbers, or attendance records.

## Product Principles

- The home screen is the officer task board.
- One list of work beats a widget wall.
- Shared board first; people accounts later.
- Club-specific terms live in data, not in the product chrome.
