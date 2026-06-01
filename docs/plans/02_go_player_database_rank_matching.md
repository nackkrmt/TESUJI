# 02 Go Player Database And Rank Matching

## Objective

ทำฐานข้อมูล ranking อ้างอิงให้ใช้งานจริงก่อน register เต็มรูปแบบ เพราะ Player signup ต้องค้นชื่อแล้วสร้าง profile เป็น verified/pending ตามผลค้นหา

## Data Sources

- DAN Excel
  - priority สูงสุด
  - ถ้าเจอใน DAN ให้หยุด ไม่ดู KYU/AWARD

- KYU Excel
  - rank empty ตัดทิ้ง
  - rank 16-99999 แปลงเป็น 15 Kyu
  - ชื่อซ้ำใช้ rank ที่ดีที่สุด ถ้าเท่ากันใช้วันที่ล่าสุด

- AWARD Excel
  - ใช้เฉพาะอันดับ 1, 2, 3
  - map `rank_in_category` เป็น rank ตาม masterplan
  - Kyu range ที่ไม่ได้อยู่ใน table ให้ใช้สูตร best Kyu in range - 1, cap 1-15 Kyu
  - `9x9` และ `13x13` map เป็น 12 Kyu
  - `category` เก็บเป็น metadata/display/audit เท่านั้น ไม่ใช้คำนวณ rank หรือ power_level
  - cap ดีสุดที่ 1 Kyu

## Tables

- `go_player_database`
  - source, seq, prefix, first/last name, normalized name
  - rank, power_level, rating, year, award fields, raw_data
  - indexes: source, trigram first/last name, normalized fields

## Import Pipeline

1. Upload file in admin page
2. Parse with `xlsx`
3. Validate required columns per source
4. Normalize Thai names
5. Convert rank to canonical display:
   - `X Dan`
   - `X Kyu`
6. Convert rank to power level
7. Dedupe per source where required
8. Show preview with row counts, skipped rows, warning rows
9. Admin confirms import
10. Transaction:
   - delete existing rows for source
   - insert parsed rows
   - run live sync candidate update for player profiles

## Rank Matching Service

Input:

- `first_name_th`
- `last_name_th`

Output:

- `status`: `matched`, `multiple`, `not_found`
- `rank`, `power_level`, `rating`, `source`
- `candidates[]` max 5 for fuzzy/multiple result

Algorithm:

1. Search DAN exact
2. Search DAN normalized
3. Search DAN trigram similarity > 0.4
4. If any DAN candidate selected/confirmed, use DAN and stop
5. Search KYU and AWARD exact in parallel
6. If not found, normalized in parallel
7. If not found, trigram in parallel
8. If KYU and AWARD both found, choose higher `power_level`
9. If none found, return `not_found`

## UI/Admin Functions

- `/admin/database`
  - source tabs: DAN, KYU, AWARD, Institute
  - upload, validate, preview, import
  - show latest upload count/time per source

- Search sandbox inside admin
  - type Thai first/last name
  - show exact/normalized/fuzzy path used
  - show chosen priority result

## Failure Cases

- Missing required columns: block import
- Invalid rank: row-level warning; block only if critical
- Empty name: skip row
- Duplicate rows: show dedupe summary
- Large file parse error: show readable Thai error
- Import DB failure: transaction rollback

## Acceptance Tests

- DAN match wins over KYU/AWARD
- KYU rank 16 becomes 15 Kyu
- AWARD rank_in_category maps correctly
- AWARD unmapped real-file values are reported before import
- Thai normalization handles listed character swaps
- Fuzzy returns max 5 candidates
- Not found returns self-declare path
- Import refreshes only selected source, not all sources
