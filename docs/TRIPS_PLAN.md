# Trips Module — Design Plan

Status: **proposed** · Owner: @mattsavin · Last updated: 2026-08-25

## Why

Outdoor meets are the core of a mountaineering club, but the current sessions model is
indoor-shaped: fixed-capacity slots at walls, booked free of charge. Trips have fundamentally
different needs:

| Concern         | Sessions                | Trips                                        |
| --------------- | ----------------------- | -------------------------------------------- |
| Cost            | Free                    | Transport + accommodation share (real money) |
| Sign-up window  | Until start             | Closes days ahead for logistics              |
| Capacity driver | Wall ratio limits       | Minibus seats / bunk beds                    |
| Commitment      | Turn up or lose nothing | No-show strands the group and costs the club |
| Kit             | Personal/hire           | Group kit list per trip                      |

This module treats trips as first-class entities alongside sessions, reusing the existing
auth/membership/email/audit infrastructure.

## Goals

1. Committee can create trips (destination, dates, cost breakdown, capacity by seat type,
   kit list, sign-up deadline).
2. Members can sign up, see what they owe, and see their payment status.
3. Committee tracks who has paid deposits/balances; the system never _handles_ money —
   it tracks it (SU rules: bank transfer/cash in person).
4. Automatic confirmation emails on sign-up; deadline reminder before close.
5. Full audit-trail coverage of every privileged trip mutation.

Non-goals (explicitly): online payments, external booking providers.

## Data model

```sql
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    description TEXT,
    startDate TEXT NOT NULL,          -- ISO
    endDate TEXT NOT NULL,
    meetupPoint TEXT,
    costBreakdown TEXT,               -- JSON: { transport: 25, bunkhouse: 30 }
    totalCostPerPerson REAL NOT NULL,
    depositAmount REAL NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL,
    signupClosesAt TEXT NOT NULL,     -- ISO; enforced server-side
    requiredMembership TEXT DEFAULT 'basic',
    visibility TEXT DEFAULT 'all',    -- mirrors sessions
    status TEXT NOT NULL DEFAULT 'open' -- open | closed | cancelled | completed
);

CREATE TABLE IF NOT EXISTS trip_signups (
    id TEXT PRIMARY KEY,
    tripId TEXT NOT NULL REFERENCES trips(id),
    userId TEXT NOT NULL REFERENCES users(id),
    signedUpAt INTEGER NOT NULL,
    paymentStatus TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | deposit-paid | paid
    paidAmount REAL NOT NULL DEFAULT 0,
    cancelledAt INTEGER,              -- NULL = active signup
    UNIQUE (tripId, userId)
);
```

Notes:

- `UNIQUE(tripId, userId)` makes double-signups impossible at the schema level.
- Cancellation is soft (`cancelledAt`) so payment history survives.
- `paymentStatus` is committee-set only; members can read their own row.
- Waitlists deliberately deferred (phase 3): trips rarely fill instantly like wall slots;
  manual management via the portal covers real usage.

## API surface

```
GET    /api/trips                          member+ (visible only)
GET    /api/trips/:id                      member+ (own signup embedded)
POST   /api/trips                          committee — create (audited)
PUT    /api/trips/:id                      committee — edit (audited)
DELETE /api/trips/:id                      committee — cancel (audited; emails signups)
POST   /api/trips/:id/signup               member — capacity + deadline checked server-side
POST   /api/trips/:id/cancel-signup        member — until deadline passes
GET    /api/trips/:id/signups              committee — full roster + payment status
POST   /api/trips/:id/signups/:userId/pay  committee — set paymentStatus/paidAmount (audited)
```

Server-side enforcement on every signup:

- membership requirement met (mirrors session booking)
- `signupClosesAt` not passed
- capacity available (transactional pattern from bookings)
- status = open

Cancellation after `signupClosesAt` → allowed but flagged `lateCancel` in audit log
(committee sees it; no automatic penalty in v1).

## Emails

| Event                        | To                         | Content                                                  |
| ---------------------------- | -------------------------- | -------------------------------------------------------- |
| Signup confirmed             | member                     | Trip summary, total owed, payment instructions, deadline |
| Payment recorded             | member                     | What was marked paid, remaining balance                  |
| Trip cancelled               | all active signups         | Apology + refund process pointer (manual)                |
| Deadline approaching (T-48h) | committee roster view flag | n/a — surfaced in portal, not email                      |

All reuse `sendEmail` fire-and-forget patterns.

## Audit coverage

`trip.create`, `trip.update`, `trip.cancel`, `trip.signup.payment`,
`roster.import`-style summaries for bulk ops — same `logAudit` shape as admin actions.

## Frontend

- Public/member: new `/trips` page (list + detail cards), linked from navbar.
- Dashboard: "My Trips" card (upcoming, payment status).
- Committee: "Manage Trips" card in admin portal — create/edit form, roster table
  with payment-status dropdowns, cancel button (confirm modal).

## Phasing

| Phase     | Contents                                                  | Estimate    |
| --------- | --------------------------------------------------------- | ----------- |
| 1         | Schema migration + CRUD API + tests (no emails yet)       | 1 evening   |
| 2         | Member signup flow + frontend pages + confirmation emails | 1 evening   |
| 3         | Payment tracking UI + deadline reminders + audit wiring   | 1 evening   |
| 4 (later) | Waitlist, attendance tie-in with QR verify                | unscheduled |

Each phase ships independently behind the normal dev→beta→main flow.

## Open questions for the committee

Decisions taken 2026-08-26 (Matt):

1. **Refund policy wording for late cancels** — _no decision yet; leave templated._
   Late-cancel email/portal copy must use an explicit `[REFUND POLICY — TBC BY COMMITTEE]`
   placeholder, never invented policy.
2. **Guests on trips** — _members only for now._ Schema's nullable-userId escape hatch stays
   unused; signup validation requires a real member.
3. **Payment records authority** — _treasurer or president only._ Payment-status mutations
   (phase 3) must be restricted beyond `requireCommittee` to these roles. NOTE: seeded role
   labels use "Chair" not "President" — confirm exact role-string match at implementation.
4. **Minimum trip numbers** — _manual._ No at-risk flag or auto-cancel logic; committee
   watches the roster themselves.

## Risks

- Money tracking is manual: the system must make clear it reflects _committee bookkeeping_,
  not actual bank state. Copy should say "recorded as paid".
- Deadline enforcement depends on server clock; fine on single-host Docker.
- SQLite single-writer: fine at club scale (same rationale as bookings).
