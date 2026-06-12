/* Generate docs/TEST_PLAN_UAT.md from the tesuji-uat-plan workflow output. */
const fs = require('fs');

// Source: the saved workflow payload (scripts/uat-source.json). You can also pass a
// raw task .output file as argv[2]; both shapes are handled below.
const SRC = process.argv[2] || `${__dirname}/uat-source.json`;
const DEST = process.argv[3] || `${__dirname}/../docs/TEST_PLAN_UAT.md`;
const GEN_DATE = '2026-06-13';

const parsed = JSON.parse(fs.readFileSync(SRC, 'utf8'));
// Accept either the inner {suites,gaps} object, or a task .output wrapper {result: ...}.
const d = parsed.suites
  ? parsed
  : typeof parsed.result === 'string'
    ? JSON.parse(parsed.result)
    : parsed.result;
const suites = d.suites || [];
const gaps = d.gaps || {};

const SHORT = [
  'Auth & Registration',
  'Profile & Coach Link',
  'Tournament — Admin CRUD + Public',
  'Tournament Registration',
  'Payment / Slip / My-Registrations / Cancel / Waiting-list',
  'Admin Operations Queues + Referee Invite',
  'Manual Notifications',
  'Admin Database Upload + Search',
  'Home / Digital ID + Navigation',
];

const esc = (s) => String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\s+$/,'').trim();
const out = [];
const w = (s = '') => out.push(s);

function anchor(i) { return `suite-${i + 1}`; }

// ---- counts ----
function counts(cases) {
  const c = { P0: 0, P1: 0, P2: 0, happy: 0, negative: 0, edge: 0 };
  for (const t of cases) { if (c[t.priority] != null) c[t.priority]++; if (c[t.type] != null) c[t.type]++; }
  return c;
}
const totalCases = suites.reduce((n, s) => n + (s.testCases || []).length, 0);
const totalAll = counts(suites.flatMap((s) => s.testCases || []));

// ===================== HEADER =====================
w('# TESUJI — แผนทดสอบระบบโดยผู้ใช้ (Owner-run End-to-End UAT Plan)');
w('');
w(`> สร้างเมื่อ ${GEN_DATE} โดยอ่านโค้ดจริงของแต่ละ subsystem (workflow \`tesuji-uat-plan\`, 9 readers + completeness critic). ` +
  `ทุก step/field/ปุ่ม/ผลลัพธ์อ้างอิงจากโค้ดและพฤติกรรม RPC จริงใน \`docs/AI_HANDOFF.md\` ณ วันที่สร้าง — ถ้าโค้ดเปลี่ยน ให้รัน generator ใหม่หรือแก้รายการที่กระทบ`);
w('');
w(`**ผู้รัน:** เจ้าของโปรเจกต์ (owner QA) ทดสอบด้วยมือบนเบราว์เซอร์ก่อน launch  •  **ขอบเขต:** ทั้งระบบ end-to-end ทุก role (player / coach / referee / admin)`);
w('');
w(`**สรุปจำนวน:** ${suites.length} suites · **${totalCases} test cases** — P0 \`${totalAll.P0}\` / P1 \`${totalAll.P1}\` / P2 \`${totalAll.P2}\` · happy \`${totalAll.happy}\` / negative \`${totalAll.negative}\` / edge \`${totalAll.edge}\``);
w('');

// ===================== TOC + coverage table =====================
w('## สารบัญ & coverage');
w('');
w('| # | Suite | Cases | P0 | P1 | P2 | happy | neg | edge |');
w('|---|-------|------:|---:|---:|---:|------:|----:|-----:|');
suites.forEach((s, i) => {
  const c = counts(s.testCases || []);
  w(`| ${i + 1} | [${SHORT[i] || s.subsystem}](#${anchor(i)}) | ${(s.testCases || []).length} | ${c.P0} | ${c.P1} | ${c.P2} | ${c.happy} | ${c.negative} | ${c.edge} |`);
});
w(`| | **รวม** | **${totalCases}** | **${totalAll.P0}** | **${totalAll.P1}** | **${totalAll.P2}** | **${totalAll.happy}** | **${totalAll.negative}** | **${totalAll.edge}** |`);
w('');
w('ภาคผนวก: [A — ช่องโหว่ความครอบคลุม & เคสเสริม](#appendix-a) · [B — ข้อสังเกต/บั๊กที่อาจพบ](#appendix-b) · [C — ตาราง sign-off](#appendix-c)');
w('');
w('---');
w('');

// ===================== 0. วิธีใช้ =====================
w('## 0. วิธีใช้เอกสารนี้');
w('');
w('- ทุกเคสมี checkbox `[ ]` — ติ๊กเมื่อผ่าน และเติมบรรทัด **Result** ว่า pass/fail + เลขบั๊ก/หมายเหตุ');
w('- **Priority:** `P0` = ต้องผ่านก่อน launch (critical path / ความปลอดภัยข้อมูล) · `P1` = สำคัญ · `P2` = เสริม/ขอบเขต');
w('- **Type:** `happy` = เส้นทางปกติต้องสำเร็จ · `negative` = ต้องถูกปฏิเสธ/แสดง error · `edge` = ขอบเขต/กรณีพิเศษ');
w('- รันตามลำดับใน [§3 ลำดับการทดสอบ](#exec-order) เพราะหลาย flow มี dependency (เช่น ต้องมีทัวร์นาเมนต์เปิดอยู่ก่อนถึงจะลงทะเบียนได้)');
w('- ตรวจผลทั้ง **UI** (ข้อความ/สถานะที่เห็น) และ **DB** (แถว/คอลัมน์/สถานะใน Supabase) ตามที่ระบุในแต่ละเคส');
w('');

// ===================== 1. environment =====================
w('## 1. การเตรียม Environment');
w('');
w('```bash');
w('# เปิด dev server (ใช้ host/port นี้ให้ตรงกับที่ทีมใช้)');
w('npm run dev -- --hostname 127.0.0.1 --port 3000');
w('# => base URL: http://127.0.0.1:3000');
w('```');
w('');
w('- ⚠️ **ห้ามรัน `npm run build` ขณะ dev server กำลังทำงานบนโฟลเดอร์เดียวกัน** — ทั้งคู่เขียน `.next/` ทำให้ bundle ชนกันแล้วเกิด hydration error (เช่นบน `/register`). ถ้าเจอ: kill dev, ลบ `.next`, แล้ว start dev ใหม่');
w('- `.env.local` ต้องมีครบ: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (หรือ `SUPABASE_SERVICE_ROLE_KEY`), `IDENTITY_HASH_SALT` — ถ้าขาด secret key signup จะ 500, ถ้าขาด salt signup จะ throw');
w('- เปิด **DevTools** ค้างทุกการเทส: **Console** (จับ error/warning), **Application ▸ Cookies** (เช็ก persistent vs session), **Network** (เช็ก HTTP status ของ API)');
w('- **User pages** (`/`, `/login`, `/register`, `/profile`, `/tournaments*`, `/payments*`, `/my-registrations*`, `/notifications`, `/referee/invite`) แสดงใน **mobile frame** เสมอแม้บน desktop');
w('- **Admin pages** (`/admin*`) เป็น desktop และ **ยังไม่มี route guard ใน dev mode** → เปิด URL ตรงได้เลยโดยไม่ต้อง login admin (เป็น locked decision ของ dev mode)');
w('- ต้องมีสิทธิ์เข้า **Supabase dashboard** (project ref `jiweobnsxpmgexipqzbx`) เพื่อ seed admin role, ตรวจ DB rows, และ cleanup');
w('');

// ===================== 2. test data + cleanup =====================
w('## 2. ข้อตกลง Test Data + Cleanup');
w('');
w('- ⚠️ **ทุกอย่างเขียนลง Supabase โปรเจกต์จริง** — ใช้ prefix `uat-` กับ email / ชื่อ / title ทัวร์นาเมนต์ทุกครั้ง เพื่อให้ค้นหา + ลบทิ้งง่าย');
w('- **ห้ามใส่เลขบัตรประชาชน/passport จริง** — ใช้ค่า dummy ที่ไม่ซ้ำ (ระบบเก็บเป็น salted SHA-256 hash เท่านั้น ไม่เก็บค่าดิบ)');
w('- จดรายการสิ่งที่สร้างระหว่างเทสไว้: `auth.users`, `accounts`, `tournaments`/`divisions`, `payment_orders`, `registrations`, `promo_code_usages`, `manual_notifications`(+recipients), `referee_invite_codes`, และ Storage objects ใน bucket `slips` / `tournament-banners`');
w('- **Cleanup หลังเทส:** ลบ auth users (rows ที่เกี่ยวจะ cascade), ลบ tournament/division/registration/payment, ลบ Storage objects, ลบ notifications/invites แล้วรัน query ยืนยันว่าไม่เหลือ `uat-%`');
w('- **Admin actor:** ใน dev mode admin actions ส่ง `null` เป็น `p_admin_account_id` ได้ ถ้าจะเทสเส้นทางที่ต้องมี admin จริง ให้ seed ด้วยมือ: ตั้ง `account_roles.admin = active` ให้บัญชี `uat-admin`');
w('');

// ===================== 3. accounts + exec order =====================
w('<a id="exec-order"></a>');
w('## 3. Test Accounts + ลำดับการทดสอบ (Execution Order)');
w('');
w('### 3.1 บัญชีทดสอบที่ต้องเตรียม');
w('');
w('| บัญชี | Role | ใช้ทำอะไร |');
w('|-------|------|-----------|');
w('| `uat-admin@example.com` | admin (seed ด้วยมือ) | ใช้เป็น admin actor จริงเมื่อต้องการ; เปิด `/admin*` |');
w('| `uat-player-self@example.com` | player | rank แบบ self-declared → `pending` (ทดสอบ rank approval) |');
w('| `uat-player-matched@example.com` | player | rank แบบ matched จาก Go DB → `verified` |');
w('| `uat-coach@example.com` | coach (pending→approve) | ได้ active `player` ทันที, `coach` รออนุมัติ; ทดสอบ Coach Link + register linked player |');
w('| `uat-player-linked@example.com` | player | เป็น player ที่ coach ขอ link เพื่อลงแข่งแทน |');
w('| `uat-referee@example.com` | player→referee | redeem referee invite code |');
w('');
w('### 3.2 ลำดับแนะนำ (รันครบหนึ่งรอบ)');
w('');
w('> มาจาก completeness critic — เรียงตาม dependency ของข้อมูลจริง');
w('');
const order = gaps.recommendedOrder || [];
if (order.length) order.forEach((o, i) => w(`${i + 1}. ${esc(o)}`));
else w('_(ไม่มีลำดับจาก critic)_');
w('');
w('### 3.3 Dependency ข้าม flow ที่ต้องระวัง');
w('');
const xf = gaps.crossFlowDependencies || [];
if (xf.length) xf.forEach((x) => w(`- ${esc(x)}`));
else w('_(ไม่มี)_');
w('');
w('---');
w('');

// ===================== SUITES =====================
function renderCase(t) {
  const head = `**${t.id}** · \`${t.priority}\` \`${t.type}\` \`${esc(t.role)}\` — ${esc(t.title)}`;
  w(`- [ ] ${head}`);
  if (t.preconditions && t.preconditions.length) {
    w(`  - **Pre:**`);
    t.preconditions.forEach((p) => w(`    - ${esc(p)}`));
  }
  if (t.steps && t.steps.length) {
    w(`  - **Steps:**`);
    t.steps.forEach((s, i) => w(`    ${i + 1}. ${esc(s)}`));
  }
  if (t.expected && t.expected.length) {
    w(`  - **Expected:**`);
    t.expected.forEach((e) => w(`    - ${esc(e)}`));
  }
  if (t.dbCheck && esc(t.dbCheck)) w(`  - **DB:** ${esc(t.dbCheck)}`);
  w(`  - **Result:** ⬜ pass · ⬜ fail — บันทึก: `);
  w('');
}

suites.forEach((s, i) => {
  w(`<a id="${anchor(i)}"></a>`);
  w(`## ${i + 1}. ${SHORT[i] || s.subsystem}`);
  w('');
  const c = counts(s.testCases || []);
  w(`**${(s.testCases || []).length} cases** — P0 \`${c.P0}\` / P1 \`${c.P1}\` / P2 \`${c.P2}\` · happy \`${c.happy}\` / negative \`${c.negative}\` / edge \`${c.edge}\``);
  w('');
  if (s.subsystem && s.subsystem !== SHORT[i]) { w(`<sub>${esc(s.subsystem)}</sub>`); w(''); }
  if (s.routes && s.routes.length) { w(`**Routes:** ${s.routes.map((r) => '`' + esc(r) + '`').join(' · ')}`); w(''); }
  if (s.preconditions && s.preconditions.length) {
    w('**Preconditions (suite-level):**');
    s.preconditions.forEach((p) => w(`- ${esc(p)}`));
    w('');
  }
  if (s.testDataNeeded && s.testDataNeeded.length) {
    w('<details><summary><b>Test data ที่ต้องเตรียม</b></summary>');
    w('');
    s.testDataNeeded.forEach((p) => w(`- ${esc(p)}`));
    w('');
    w('</details>');
    w('');
  }
  w('### Test cases');
  w('');
  (s.testCases || []).forEach(renderCase);
  if (s.notes && s.notes.length) {
    w('> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**');
    s.notes.forEach((n) => w(`> - ${esc(n)}`));
    w('');
  }
  w('---');
  w('');
});

// ===================== APPENDIX A =====================
w('<a id="appendix-a"></a>');
w('## ภาคผนวก A — ช่องโหว่ความครอบคลุม & เคสเสริมจาก Critic');
w('');
const gg = gaps.gaps || [];
if (gg.length) {
  w('| Area | สิ่งที่ยังขาด | เคสที่แนะนำเพิ่ม | Pri |');
  w('|------|--------------|------------------|-----|');
  gg.forEach((g) => w(`| ${esc(g.area)} | ${esc(g.missing)} | ${esc(g.suggestedCase)} | \`${esc(g.priority)}\` |`));
} else w('_(ไม่มี)_');
w('');
w('---');
w('');

// ===================== APPENDIX B =====================
w('<a id="appendix-b"></a>');
w('## ภาคผนวก B — ข้อสังเกต/บั๊กที่อาจพบ (รวมจากทุก suite)');
w('');
w('> รวมรายการ `notes` ที่ reader แต่ละตัว flag ไว้จากการอ่านโค้ด — จุดที่กำกวม อาจเป็นบั๊ก หรือควรยืนยันด้วยตาตอนเทส');
w('');
suites.forEach((s, i) => {
  if (!s.notes || !s.notes.length) return;
  w(`**${i + 1}. ${SHORT[i] || s.subsystem}**`);
  s.notes.forEach((n) => w(`- ${esc(n)}`));
  w('');
});
w('---');
w('');

// ===================== APPENDIX C =====================
w('<a id="appendix-c"></a>');
w('## ภาคผนวก C — ตาราง Sign-off (เติมหลังเทส)');
w('');
w('| # | Suite | Cases | Pass | Fail | Blocked | ผู้เทส | วันที่ | หมายเหตุ |');
w('|---|-------|------:|-----:|-----:|--------:|--------|--------|----------|');
suites.forEach((s, i) => {
  w(`| ${i + 1} | ${SHORT[i] || s.subsystem} | ${(s.testCases || []).length} | | | | | | |`);
});
w(`| | **รวม** | **${totalCases}** | | | | | | |`);
w('');
w('**สถานะรวมก่อน launch:** ⬜ ผ่านทั้งหมด · ⬜ ผ่านแบบมีเงื่อนไข · ⬜ ไม่ผ่าน (มี P0 ค้าง)');
w('');

fs.writeFileSync(DEST, out.join('\n'), 'utf8');
console.log('WROTE', DEST, out.join('\n').length, 'chars,', out.length, 'lines');
console.log('cases', totalCases, 'P0', totalAll.P0, 'P1', totalAll.P1, 'P2', totalAll.P2);
