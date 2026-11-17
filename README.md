# The GBL 80s Story: website, API and database

```
/            React front end (Vite). Offline demo mode by default; Live mode talks to the API.
/server      Node 22 + Express API, SQLite database (built-in node:sqlite, no native modules)
```

## Run it locally (Live mode)
```bash
# 1. API + database
cd server && npm install
cp .env.example .env            # then set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
set -a; . ./.env; set +a
npm run seed -- --demo          # creates the admin (+ demo contributors sale@/lakers@example.com / demo-password-1)
npm test                        # 21 end-to-end acceptance checks on a throw-away database
npm start                       # http://localhost:3000

# 2. Front end (second terminal, project root)
npm install
npm run dev:live                # Vite dev server, /api is proxied to :3000
```
Offline demo (no server): `npm run dev`, or `npm run build:preview` for one self-contained HTML file.

## Deploy (one container)
```bash
cp .env.example .env            # set JWT_SECRET (long random), ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
docker compose exec gbl80s npm run seed      # first administrator
```
Put it behind HTTPS (cookies are `Secure` in production). Minimal Caddy example:
```
gbl80s.example.org { reverse_proxy localhost:3000 }
```
Sign in at **#/contribute** with the admin account, then open **Editor area** to register club/Lakers representatives.

## Backups and export (the GBL 80s Team owns the data)
- `npm run backup` (inside `server/`, or `docker compose exec gbl80s npm run backup`) writes a dated snapshot of the database and all uploaded originals to `BACKUP_DIR`. Schedule daily with cron, then copy the folder off the server.
- **Editor area → Content → Download full content export** gives every table as JSON (no password hashes).
- Everything lives in one folder/volume: `gbl80s.db` and `uploads/`.

## What the API enforces
| Rule from the brief | Where |
|---|---|
| Club contributors only upload to their own club; cannot publish or touch other clubs | `POST /api/items` forces `club` from the account |
| Everything starts **pending**; nothing public before approval | public queries filter `status='approved'`; `/api/files/:id` returns 404 for unapproved files except to the owner and editors |
| Editors approve, request corrections, decline, remove, edit, delete | `/api/admin/items/*` |
| Permission declaration required | DB `CHECK(permission=1)` and API validation |
| JPEG / PNG / PDF, multi-file, size limit | extension filter + file-byte sniffing, `MAX_FILE_MB`, 20 files |
| Nominations private until approved; family-consulted flag; acknowledgement | `/api/nominations`, `/api/admin/nominations/*`, `/api/recognition/:cat` |
| Search by club, person, year/decade, event, type, "date unknown" | `GET /api/items?q=&club=&type=&decade=198|unknown&event=&person=` |
| Spam and security | rate limits, honeypot field, bcrypt, signed httpOnly cookie, SameSite + custom-header CSRF check, Helmet headers |
| Report a mistake or rights concern | `POST /api/items/:id/report` → Editor area → Reports |
| Audit trail | `audit` table (reviews, edits, deletes, user changes, exports) |

Roles: **public** (browse, nominate, report), **contributor** (own club only), **admin** (editor). Clubs are the 15 towns plus Gippsland Lakers; Lakes Entrance, Drouin and Phillip Island are not in the database.

## Not included yet (agreed for later)
Email notifications, image thumbnails/resizing, nomination photo moderation previews, password-reset by email (admins reset passwords in Editor area → Users), and the high-resolution Lakers logo (`src/assets/lakers.webp` is a small crop).
# GBL80s-full-project
