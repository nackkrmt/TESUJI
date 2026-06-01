# 07 Tournament Day And Realtime

## Objective

Phase 2 ทำวันแข่งให้ใช้ระบบจริงได้โดยไม่สร้าง pairing algorithm เอง: import จาก MacMahon, กรรมการ check-in/result, public live results, standings import, realtime

## Tables

- `rounds`
  - division, round_number, status

- `matches`
  - round, table_number
  - black/white profile IDs if matched
  - black/white names fallback
  - force pairing override fields
  - result, checkin, audit fields

- `standings`
  - division
  - headers JSONB
  - rows JSONB

- `schedule_templates`
  - tournament
  - events JSONB
  - assigned to divisions

## Admin Day Controls

- Start tournament: status closed -> in_progress
- Import pairing TSV per division/round
- Delete round and re-import
- Import standings TSV
- Create schedule template
- Map schedule template to divisions
- Send announcement broadcast
- Complete tournament: in_progress -> completed

## TSV Import

1. Parse file
2. Detect pairing vs standings
3. For pairing:
   - remove BYE from name candidates
   - match names to player profiles in division registrations
   - exact -> normalized -> fuzzy
   - unresolved names require manual map or string fallback
4. Preview all rows
5. Admin confirms
6. Insert/upsert rounds and matches

## Judge Page

- Referee requires active `account_roles.referee`
- Admin can also access
- Referee sees all tables in selected division/round
- Actions:
  - check-in black/white/BOTH toggle
  - submit result 1-0 or 0-1 with confirmation modal
  - reset result to ?-?
  - force pairing

## Round Lock

- When every match in round has result != ?-?, round can be locked/completed
- Old rounds are read-only for referee
- Admin may override if needed

## Realtime

- Public live results page subscribes to matches and standings
- Judge page receives updates from other referees
- Announcement banner broadcasts through Supabase Realtime
- My Status:
  - logged-in Player sees own match/result
  - Coach sees approved linked players
  - anonymous user can track names in localStorage

## Conflict Handling

- Multiple referees may update same match
- Store submitted_by/submitted_at
- UI should refresh after update and show latest DB truth
- Force pairing duplicate player marks other table as no competitor per masterplan

## Acceptance Tests

- Referee without invite cannot access judge page
- Admin imports one pairing TSV and matches known player profiles
- Unknown name survives as string fallback
- Check-in updates match and linked registration status
- Result submission requires confirmation and writes audit fields
- Public live page updates when match changes
- Standings import displays headers/rows exactly

