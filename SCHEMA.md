# Database Schema (SQLite)

The UOS Climbing application uses a local SQLite database (`uscc.db`) managed via `backend/db.ts`. The schema is initialized and migrated automatically upon server startup.

## Core Tables

### `users`
Stores all registered members, committee members, and their profile information.
- `id` (TEXT PRIMARY KEY): Unique identifier.
- `email` (TEXT UNIQUE NOT NULL): Login email.
- `passwordHash` (TEXT NOT NULL): Bcrypt hashed password.
- `firstName`, `lastName` (TEXT): User's name.
- `role` (TEXT) `DEFAULT 'member'`: Authorization level (`member` or `committee`).
- `membershipStatus` (TEXT) `DEFAULT 'pending'`: Global membership approval state.
- `emailVerified` (INTEGER) `DEFAULT 0`: Boolean flag for OTP verification.
- *Profile Fields*: `registrationNumber`, `emergencyContactName`, `emergencyContactMobile`, `pronouns`, `dietaryRequirements`, `instagram`, `faveCrag`, `bio`, `profilePhoto`.

### `membership_types`
Defines available membership tiers (e.g., Basic, Competition Team).
- `id` (TEXT PRIMARY KEY): e.g., 'basic', 'bouldering'.
- `label` (TEXT NOT NULL): Display name.
- `deprecated` (INTEGER) `DEFAULT 0`: Boolean flag to hide legacy types.

### `user_memberships`
Many-to-many junction table mapping users to specific membership types for a given academic year.
- `id` (TEXT PRIMARY KEY): Unique identifier.
- `userId` (TEXT NOT NULL): Foreign key to `users`.
- `membershipType` (TEXT NOT NULL): Foreign key to `membership_types`.
- `status` (TEXT) `DEFAULT 'pending'`: Approval status (`pending`, `active`, `rejected`).
- `membershipYear` (TEXT NOT NULL): The academic year (e.g., "2024/2025").

## Event & Booking Tables

### `sessions`
Represents club events, training sessions, and socials.
- `id` (TEXT PRIMARY KEY): Unique identifier.
- `type` (TEXT NOT NULL): Classification (e.g., 'Social', 'Competition').
- `title` (TEXT NOT NULL): Event name.
- `date` (TEXT NOT NULL): ISO datetime string.
- `capacity` (INTEGER NOT NULL): Maximum allowed attendees.
- `bookedSlots` (INTEGER) `DEFAULT 0`: Current attendee count.
- `requiredMembership` (TEXT) `DEFAULT 'basic'`: Minimum membership tier required to book.
- `visibility` (TEXT) `DEFAULT 'all'`: Defines who can see the event (`all` or `committee_only`).
- `location` (TEXT): Physical location of the event.

### `bookings`
Many-to-many junction table linking users to sessions they plan to attend.
- `userId` (TEXT NOT NULL): Foreign key to `users`.
- `sessionId` (TEXT NOT NULL): Foreign key to `sessions`.
- *Primary Key*: Composite `(userId, sessionId)`.

## Elections & Voting Tables

### `candidates`
Stores profiles for users running for committee roles.
- `userId` (TEXT PRIMARY KEY): Foreign key to `users`.
- `role` (TEXT NOT NULL): The position being applied for.
- `manifesto` (TEXT NOT NULL): Candidate's pitch.
- `presentationLink` (TEXT): Optional link to slides/video.

### `votes`
Records anonymous votes cast during an election.
- `userId` (TEXT PRIMARY KEY): Foreign key to `users`. Enforces one vote per user per election.
- `candidateId` (TEXT NOT NULL): Foreign key to `users` (the candidate receiving the vote).

### `referendums`
Stores policy questions or constitutional changes requiring a club-wide vote.
- `id` (TEXT PRIMARY KEY): Unique identifier.
- `title`, `description` (TEXT NOT NULL).

### `referendum_votes`
Records votes cast on specific referendums.
- `userId` (TEXT NOT NULL): Foreign key to `users`.
- `referendumId` (TEXT NOT NULL): Foreign key to `referendums`.
- `choice` (TEXT NOT NULL): 'yes', 'no', or 'abstain'.
- *Primary Key*: Composite `(userId, referendumId)`.

## Gear & Inventory Tables

### `gear`
Stores the club's equipment inventory.
- `id` (TEXT PRIMARY KEY): Unique identifier.
- `name` (TEXT NOT NULL).
- `totalQuantity` (INTEGER NOT NULL): Absolute physical inventory limit.
- `availableQuantity` (INTEGER NOT NULL): Currently available items (total - active requests).

### `gear_requests`
Tracks member requests to borrow equipment.
- `id` (TEXT PRIMARY KEY).
- `userId` (TEXT NOT NULL): Foreign key to `users`.
- `gearId` (TEXT NOT NULL): Foreign key to `gear`.
- `status` (TEXT) `DEFAULT 'pending'`: Workflow state (`pending`, `approved`, `returned`, `rejected`).
- `requestDate` (TEXT NOT NULL).
- `returnDate` (TEXT): When the gear was actually returned.

## System & Media Tables

### `gallery`
Stores metadata for homepage carousel and gallery images.
- `id` (TEXT PRIMARY KEY).
- `filename`, `filepath` (TEXT NOT NULL): Storage location (usually relative to `/public/uploads/`).
- `caption` (TEXT).
- `featured` (INTEGER) `DEFAULT 0`: Boolean flag for homepage carousel inclusion.
- `heroDesktopX`, `heroDesktopZoom`, etc. (REAL): Geometrical coordinates for viewport cropping.

### `config`
Key-value store for global application settings.
- `key` (TEXT PRIMARY KEY): e.g., 'electionsOpen'.
- `value` (TEXT NOT NULL).
