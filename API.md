# REST API Documentation

The UOS Climbing backend provides a RESTful API powered by Express.js. All endpoints are prefixed with `/api`. 
This document outlines the high-level services and their primary endpoints.

## Authentication (`/api/auth`)
Handles JSON Web Token (JWT) generation, registration, and session management.

- `POST /api/auth/register`
  - **Body:** `{ firstName, lastName, email, password, registrationNumber, ...profileFields }`
  - **Action:** Creates a new user, hashes the password, and initiates the OTP verification flow.
- `POST /api/auth/login`
  - **Body:** `{ email, password }`
  - **Response:** Sets HTTP-only `token` cookie. Returns user profile and roles.
- `POST /api/auth/logout`
  - **Action:** Clears the HTTP-only JWT cookie.
- `GET /api/auth/me`
  - **Response:** Returns the currently authenticated user's profile and membership status.

## Events & Sessions (`/api/sessions`)
Manages climbing sessions, socials, and training events.

- `GET /api/sessions`
  - **Response:** List of upcoming events. (Filters applied based on user role and membership).
- `POST /api/sessions/:id/book`
  - **Auth Required:** Yes
  - **Action:** Books a slot for the authenticated user, incrementing `bookedSlots`. Returns error if capacity is full.
- `POST /api/sessions/:id/cancel`
  - **Auth Required:** Yes
  - **Action:** Cancels the user's booking, decrementing `bookedSlots`.
- `GET /api/sessions/ical/:userId/:token`
  - **Auth Required:** Token Auth (URL parameter)
  - **Response:** Dynamic `.ics` calendar feed format for Apple, Google, and Outlook calendars.

## Administration (`/api/admin`)
Requires Committee privilege (`user.role === 'committee'`).

- `GET /api/admin/users`
  - **Response:** Complete list of all registered users and their membership states.
- `GET /api/admin/csv`
  - **Response:** Prompts a `.csv` file download of the full member roster.
- `POST /api/admin/sessions`
  - **Body:** Requirements for creating a new session (`title`, `capacity`, `date`, `type`, etc.).
- `PUT /api/admin/sessions/:id`
  - **Body:** Modified session constraints (e.g., changing visibility or manual slot adjustment).
- `DELETE /api/admin/sessions/:id`
  - **Action:** Removes the session and cascaded bookings.
- `PUT /api/admin/users/:id/membership`
  - **Body:** `{ status: 'active' | 'rejected', membershipYear, membershipType }`
  - **Action:** Approves or rejects a pending membership application.

## Gear Inventory (`/api/gear`)
Manages the club's borrowable climbing equipment.

- `GET /api/gear`
  - **Response:** Lists all gear and current `availableQuantity`.
- `POST /api/gear/:id/request`
  - **Auth Required:** Yes
  - **Action:** Submits a request to borrow an item. Stock is *not* decremented until approved.
- `GET /api/gear/requests` (Committee Only)
  - **Response:** List of all pending member requests.
- `POST /api/gear/requests/:request_id/approve` (Committee Only)
  - **Action:** Approves the loan, decrements `availableQuantity`, and dispatches a confirmation email.
- `POST /api/gear/requests/:request_id/return` (Committee Only)
  - **Action:** Marks the item as returned and restores the `availableQuantity`.

## Gallery & Media (`/api/gallery`)
Handles image uploads for the homepage hero carousel and public gallery.

- `GET /api/gallery`
  - **Response:** Array of image metadata objects, including crop coordinates.
- `POST /api/gallery/upload` (Committee Only)
  - **Content-Type:** `multipart/form-data`
  - **Payload:** Maps physical files to captioned data keys.
- `PUT /api/gallery/:id` (Committee Only)
  - **Body:** Updates to `caption`, `featured` status, or mathematical zoom/pan coordinates.
- `DELETE /api/gallery/:id` (Committee Only)
  - **Action:** Removes the database reference and deletes the file from `/uploads`.

## Elections & Voting (`/api/voting`)
Handles democratic processes within the club.

- `GET /api/voting/candidates`
  - **Response:** List of approved committee candidates and their manifestos.
- `POST /api/voting/apply`
  - **Body:** `{ role, manifesto, presentationLink }`
  - **Action:** Submits a candidacy for an upcoming election.
- `POST /api/voting/vote`
  - **Auth Required:** Yes
  - **Body:** `{ candidateId }`
  - **Action:** Casts an anonymous vote. Restricted to one vote per member per election.
- `GET /api/voting/referendums`
  - **Response:** Retrieves active referendums. Includes the current user's vote if authenticated.
- `POST /api/voting/referendums/:id/vote`
  - **Body:** `{ choice: 'yes' | 'no' | 'abstain' }`
  - **Action:** Upserts the user's vote on a specific referendum.

## Committee Config (`/api/committee`)
High-level system administration capabilities.

- `GET /api/committee/config`
  - **Response:** Current state of overarching system settings (e.g., `electionsOpen`).
- `PUT /api/committee/config`
  - **Body:** Key-value pairs to mutate variables affecting the entire website.
