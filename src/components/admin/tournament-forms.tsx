"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { WheelDatePicker } from "@/components/mobile/wheel-date-picker";
import {
  createTournamentAction,
  deleteDraftTournamentAction,
  setTournamentStatusAction,
  updateTournamentAction,
  upsertDivisionAction,
  upsertPromoCodeAction,
  type TournamentActionState,
} from "@/app/admin/tournaments/actions";
import { selfDeclaredRankOptions } from "@/lib/auth/rank-options";
import { rankToPowerLevel } from "@/lib/go/ranks";
import type {
  DivisionRecord,
  PromoCodeRecord,
  TournamentRecord,
  TournamentStatus,
} from "@/lib/tournaments/admin";

const initialState: TournamentActionState = {
  status: "idle",
  message: "",
};

const inputClassName =
  "min-h-11 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#526087] focus-visible:ring-2 focus-visible:ring-[#6c72ff]";
const textareaClassName =
  "min-h-28 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#526087] focus-visible:ring-2 focus-visible:ring-[#6c72ff]";
const selectClassName =
  "min-h-11 cursor-pointer rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[#6c72ff]";
const fileClassName =
  "min-h-11 cursor-pointer rounded-md border border-dashed border-[#3a4770] bg-[#0a1128] px-3 py-2 text-sm text-[#dce3ff] outline-none transition file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#20255d] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#dce3ff] hover:border-[#6c72ff] focus-visible:ring-2 focus-visible:ring-[#6c72ff]";

type TournamentFormRecord = TournamentRecord & {
  divisions?: DivisionRecord[];
};

type DivisionDraft = {
  clientId: string;
  id?: string;
  name: string;
  minPowerLevel: string;
  maxPowerLevel: string;
  minAge: string;
  maxAge: string;
  feeAmount: string;
  maxPlayers: string;
  timeSlotLabel: string;
};

const timeSlotOptions = ["เช้า", "บ่าย", "เต็มวัน"] as const;
const powerLevelOptions = [
  { label: "9x9", value: "0" },
  { label: "13x13", value: "1" },
  ...selfDeclaredRankOptions.map((rank) => ({
    label: rank,
    value: String(rankToPowerLevel(rank) ?? ""),
  })),
].filter((option) => option.value !== "");
const ageOptions = Array.from({ length: 101 }, (_, age) => String(age));
const ageSelectOptions = ageOptions.map((age) => ({ label: age, value: age }));
const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minuteOptions = ["00", "15", "30", "45"];

export function TournamentForm({
  mode,
  tournament,
}: {
  mode: "create" | "update";
  tournament?: TournamentFormRecord;
}) {
  const action = mode === "create" ? createTournamentAction : updateTournamentAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [eventDate, setEventDate] = useState(() => formatDateOnly(tournament?.eventDate ?? tournament?.eventStartsAt));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(() => formatDateTimeLocal(tournament?.registrationOpensAt));
  const [registrationClosesAt, setRegistrationClosesAt] = useState(() => formatDateTimeLocal(tournament?.registrationClosesAt));
  const [divisions, setDivisions] = useState<DivisionDraft[]>(() => toInitialDivisionDrafts(tournament?.divisions));
  const divisionsJson = useMemo(
    () => JSON.stringify(divisions.map(toDivisionPayload)),
    [divisions],
  );

  function updateDivision(index: number, field: keyof DivisionDraft, value: string) {
    setDivisions((current) =>
      current.map((division, divisionIndex) =>
        divisionIndex === index ? { ...division, [field]: value } : division,
      ),
    );
  }

  function addDivision() {
    setDivisions((current) => [
      ...current,
      createEmptyDivisionDraft(`new-${current.length + 1}-${Date.now()}`),
    ]);
  }

  function removeDivision(index: number) {
    setDivisions((current) => current.filter((_, divisionIndex) => divisionIndex !== index));
  }

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-[#202a49] bg-[#101832] p-5">
      {tournament ? <input type="hidden" name="tournamentId" value={tournament.id} /> : null}
      <input type="hidden" name="divisionsJson" value={divisionsJson} readOnly />
      <input type="hidden" name="eventDate" value={eventDate} readOnly />
      <input type="hidden" name="registrationOpensAt" value={registrationOpensAt} readOnly />
      <input type="hidden" name="registrationClosesAt" value={registrationClosesAt} readOnly />
      <input type="hidden" name="existingBannerUrl" value={tournament?.bannerUrl ?? ""} readOnly />
      <input type="hidden" name="bannerAlt" value={tournament?.bannerAlt ?? tournament?.title ?? ""} readOnly />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">
            {mode === "create" ? "Create Tournament" : "Tournament Details"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {mode === "create" ? "สร้างรายการแข่งขันใหม่" : tournament?.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8390bd]">
            กรอกรายละเอียดรายการและรุ่นการแข่งขันทั้งหมดในฟอร์มเดียว ระบบจะบันทึกลง Supabase พร้อมกัน
          </p>
        </div>
        {state.id && mode === "create" ? (
          <Link
            href={`/admin/tournaments/${state.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
          >
            Open tournament
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">รายละเอียดงาน</h3>
          <p className="mt-1 text-sm leading-6 text-[#8390bd]">
            ใช้ชื่อรายการเดียวสำหรับทุกภาษา และเพิ่มข้อมูลสถานที่จาก Google Maps ได้โดยตรง
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ชื่องาน" name="title" required defaultValue={tournament?.title} />
          <div className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
            วันที่จัดงาน
            <WheelDatePicker
              value={eventDate}
              onChange={setEventDate}
              buttonClassName={inputClassName}
              minYear={currentYear - 1}
              maxYear={currentYear + 10}
              defaultYear={currentYear}
              sheetTitle="เลือกวันที่จัดงาน"
            />
          </div>
          <Field
            label="สถานที่จัดงาน (ลิงก์ Google Maps)"
            name="googleMapsUrl"
            type="url"
            placeholder="https://maps.google.com/..."
            defaultValue={tournament?.googleMapsUrl}
          />
          <Field label="PromptPay ID" name="promptpayId" defaultValue={tournament?.promptpayId} />
          <Field label="ชื่อบัญชี PromptPay" name="promptpayName" defaultValue={tournament?.promptpayName} />
        </div>

        <div className="grid gap-4">
          <Textarea label="รายละเอียดงาน" name="description" defaultValue={tournament?.description} />
          <Textarea
            label="สถานที่จัดงาน (ข้อมูลสถานที่)"
            name="venueAddress"
            placeholder="เช่น ชั้น 4 ห้องประชุมใหญ่"
            defaultValue={tournament?.venueAddress ?? tournament?.venueName}
          />
        </div>
      </section>

      <section className="grid gap-4 border-t border-[#202a49] pt-6">
        <div>
          <h3 className="text-base font-semibold text-white">รูป Banner และช่วงรับสมัคร</h3>
          <p className="mt-1 text-sm leading-6 text-[#8390bd]">
            อัปโหลด JPG, PNG หรือ WebP ไม่เกิน 2MB เพื่อแสดงบนหน้ารายละเอียดรายการ
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
            Banner รูป
            <span className="flex min-h-11 items-center gap-3 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-[#8390bd]">
              <ImagePlus className="h-4 w-4 text-[#8c91ff]" aria-hidden />
              เลือกไฟล์จากเครื่อง
            </span>
            <input name="bannerFile" type="file" accept="image/jpeg,image/png,image/webp" className={fileClassName} />
            {tournament?.bannerUrl ? (
              <a
                href={tournament.bannerUrl}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-xs font-semibold text-[#8c91ff] transition hover:text-white"
              >
                ดู banner เดิม
              </a>
            ) : null}
          </label>

          <div className="grid gap-4">
            <DateTimeWheelField
              label="วัน-เวลาที่เปิดรับสมัคร"
              value={registrationOpensAt}
              onChange={setRegistrationOpensAt}
              minYear={currentYear - 1}
              maxYear={currentYear + 10}
              sheetTitle="เลือกวันที่เปิดรับสมัคร"
            />
            <DateTimeWheelField
              label="วัน-เวลาที่ปิดรับสมัคร"
              value={registrationClosesAt}
              onChange={setRegistrationClosesAt}
              minYear={currentYear - 1}
              maxYear={currentYear + 10}
              sheetTitle="เลือกวันที่ปิดรับสมัคร"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-[#202a49] pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">รุ่นการแข่งขันที่เปิดรับ</h3>
            <p className="mt-1 text-sm leading-6 text-[#8390bd]">
              เว้นช่วงระดับฝีมือหรืออายุว่างไว้เพื่อบันทึกเป็น Open ในฐานข้อมูล
            </p>
          </div>
          <button
            type="button"
            onClick={addDivision}
            className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            เพิ่มรุ่น
          </button>
        </div>

        <div className="grid gap-4">
          {divisions.map((division, index) => (
            <article key={division.clientId} className="rounded-lg border border-[#27345b] bg-[#0a1128] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#8c91ff]">รุ่นที่ {index + 1}</p>
                  <h4 className="mt-1 text-lg font-semibold text-white">{division.name || "ยังไม่ตั้งชื่อรุ่น"}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => removeDivision(index)}
                  disabled={divisions.length === 1}
                  aria-label={`ลบรุ่นที่ ${index + 1}`}
                  className="inline-flex min-h-10 w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-[#4a1724] px-3 py-2 text-sm font-semibold text-[#ffb0bd] transition hover:bg-[#2a1020] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden />
                  ลบรุ่น
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <ControlledField
                  label="ชื่อรุ่นการแข่งขัน"
                  required
                  value={division.name}
                  onChange={(value) => updateDivision(index, "name", value)}
                />
                <ControlledField
                  label="ราคาค่าสมัคร"
                  type="number"
                  min="0"
                  step="0.01"
                  value={division.feeAmount}
                  onChange={(value) => updateDivision(index, "feeAmount", value)}
                />
                <ControlledField
                  label="จำนวนที่รับสมัคร"
                  type="number"
                  min="1"
                  value={division.maxPlayers}
                  onChange={(value) => updateDivision(index, "maxPlayers", value)}
                  placeholder="ไม่จำกัด"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-[#dce3ff]">ระดับฝีมือที่รับ</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ControlledField
                      label="Min Power"
                      value={division.minPowerLevel}
                      onChange={(value) => updateDivision(index, "minPowerLevel", value)}
                      options={powerLevelOptions}
                      hideLabel
                    />
                    <ControlledField
                      label="Max Power"
                      value={division.maxPowerLevel}
                      onChange={(value) => updateDivision(index, "maxPowerLevel", value)}
                      options={powerLevelOptions}
                      hideLabel
                    />
                  </div>
                  <RangePreview min={division.minPowerLevel} max={division.maxPowerLevel} />
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-[#dce3ff]">อายุที่รับ</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ControlledField
                      label="Min Age"
                      value={division.minAge}
                      onChange={(value) => updateDivision(index, "minAge", value)}
                      options={ageSelectOptions}
                      hideLabel
                    />
                    <ControlledField
                      label="Max Age"
                      value={division.maxAge}
                      onChange={(value) => updateDivision(index, "maxAge", value)}
                      options={ageSelectOptions}
                      hideLabel
                    />
                  </div>
                  <RangePreview min={division.minAge} max={division.maxAge} />
                </div>

                <ControlledSelect
                  label="ช่วงเวลาที่แข่งขัน"
                  value={division.timeSlotLabel}
                  onChange={(value) => updateDivision(index, "timeSlotLabel", value)}
                >
                  {timeSlotOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </ControlledSelect>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ActionMessage state={state} />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {mode === "create" ? "สร้างรายการพร้อมรุ่นแข่งขัน" : "บันทึกรายการและรุ่นแข่งขัน"}
      </button>
    </form>
  );
}

export function TournamentStatusActions({ tournament }: { tournament: TournamentRecord }) {
  const [statusState, statusAction, isStatusPending] = useActionState(setTournamentStatusAction, initialState);
  const [deleteState, deleteAction, isDeletePending] = useActionState(deleteDraftTournamentAction, initialState);
  const nextStatuses: TournamentStatus[] = ["open", "closed", "in_progress", "completed", "cancelled"];

  return (
    <section className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">Status</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{tournament.status}</h2>
          <p className="mt-2 text-sm leading-6 text-[#8390bd]">
            Dev mode ยังไม่กันสิทธิ์ route-level; production gate จะใช้ account_roles.admin = active
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <form key={status} action={statusAction}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                disabled={isStatusPending || tournament.status === status}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-[#27345b] px-3 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status}
              </button>
            </form>
          ))}
          <form action={deleteAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <button
              type="submit"
              disabled={isDeletePending || tournament.status !== "draft"}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#4a1724] px-3 py-2 text-sm font-semibold text-[#ffb0bd] transition hover:bg-[#2a1020] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete draft
            </button>
          </form>
        </div>
      </div>
      <ActionMessage state={statusState} />
      <ActionMessage state={deleteState} />
    </section>
  );
}

export function DivisionForm({
  division,
  tournamentId,
}: {
  division?: DivisionRecord;
  tournamentId: string;
}) {
  const [state, action, isPending] = useActionState(upsertDivisionAction, initialState);

  return (
    <form action={action} className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {division ? <input type="hidden" name="divisionId" value={division.id} /> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">{division ? "Edit Division" : "Add Division"}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{division?.name ?? "New division"}</h3>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {division ? "Save" : "Add"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="ชื่อรุ่น" name="name" required defaultValue={division?.name} />
        <Field label="ค่าสมัคร" name="feeAmount" type="number" step="0.01" defaultValue={division?.feeAmount ?? 0} />
        <Field label="จำกัดคน" name="maxPlayers" type="number" defaultValue={division?.maxPlayers} />
        <Field label="Power min" name="minPowerLevel" type="number" defaultValue={division?.minPowerLevel} />
        <Field label="Power max" name="maxPowerLevel" type="number" defaultValue={division?.maxPowerLevel} />
        <Field label="Age min" name="minAge" type="number" defaultValue={division?.minAge} />
        <Field label="Age max" name="maxAge" type="number" defaultValue={division?.maxAge} />
        <Select label="Time slot" name="timeSlotLabel" defaultValue={division?.timeSlotLabel ?? "เช้า"}>
          {timeSlotOptions.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </Select>
        <Field label="Pairing method" name="pairingMethod" defaultValue={division?.pairingMethod ?? "macmahon"} />
        <Field label="Sort" name="sortOrder" type="number" defaultValue={division?.sortOrder ?? 0} />
        <Select label="Status" name="status" defaultValue={division?.status ?? "active"}>
          <option value="active">active</option>
          <option value="closed">closed</option>
          <option value="cancelled">cancelled</option>
        </Select>
        <DateField label="เริ่มรุ่น" name="startsAt" defaultValue={division?.startsAt} />
        <DateField label="จบรุ่น" name="endsAt" defaultValue={division?.endsAt} />
      </div>

      <div className="mt-3">
        <Textarea label="รายละเอียดรุ่น" name="description" defaultValue={division?.description} />
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function PromoCodeForm({
  divisions,
  promoCode,
  tournamentId,
}: {
  divisions: DivisionRecord[];
  promoCode?: PromoCodeRecord;
  tournamentId: string;
}) {
  const [state, action, isPending] = useActionState(upsertPromoCodeAction, initialState);

  return (
    <form action={action} className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      {promoCode ? <input type="hidden" name="promoCodeId" value={promoCode.id} /> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">{promoCode ? "Edit Promo" : "Add Promo"}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{promoCode?.code ?? "New promo code"}</h3>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {promoCode ? "Save" : "Add"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Code" name="code" required defaultValue={promoCode?.code} />
        <Select label="Discount type" name="discountType" defaultValue={promoCode?.discountType ?? "percentage"}>
          <option value="percentage">percentage</option>
          <option value="fixed">fixed</option>
          <option value="free">free</option>
        </Select>
        <Field label="Discount value" name="discountValue" type="number" step="0.01" defaultValue={promoCode?.discountValue ?? 0} />
        <Field label="Usage limit" name="usageLimit" type="number" defaultValue={promoCode?.usageLimit} />
        <DateField label="เริ่มใช้" name="startsAt" defaultValue={promoCode?.startsAt} />
        <DateField label="หมดเขต" name="endsAt" defaultValue={promoCode?.endsAt} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
        <Textarea label="รายละเอียด" name="description" defaultValue={promoCode?.description} />
        <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
          Scope divisions
          <select
            name="divisionIds"
            multiple
            defaultValue={promoCode?.divisionIds ?? []}
            className={`${selectClassName} min-h-24`}
          >
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-[#8390bd]">ไม่เลือก = ใช้ได้ทุก division</span>
        </label>
      </div>

      <label className="mt-4 flex w-fit items-center gap-2 text-sm font-semibold text-[#dce3ff]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={promoCode?.isActive ?? true}
          className="h-4 w-4 rounded border-[#27345b] bg-[#0a1128]"
        />
        Active
      </label>
      <ActionMessage state={state} />
    </form>
  );
}

function Field({
  defaultValue,
  label,
  name,
  placeholder,
  required,
  step,
  type = "text",
}: {
  defaultValue?: number | string | null;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={inputClassName}
      />
    </label>
  );
}

function ControlledField({
  hideLabel,
  label,
  min,
  onChange,
  options,
  placeholder,
  required,
  step,
  type = "text",
  value,
}: {
  hideLabel?: boolean;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: string;
  value: string;
}) {
  if (options) {
    return (
      <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
        <span className={hideLabel ? "sr-only" : ""}>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClassName}>
          <option value="">Open</option>
          {options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      <span className={hideLabel ? "sr-only" : ""}>{label}</span>
      <input
        type={type}
        min={min}
        step={step}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </label>
  );
}

function DateField({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
}) {
  return <Field label={label} name={name} type="datetime-local" defaultValue={formatDateTimeLocal(defaultValue)} />;
}

function DateTimeWheelField({
  label,
  maxYear,
  minYear,
  onChange,
  sheetTitle,
  value,
}: {
  label: string;
  maxYear: number;
  minYear: number;
  onChange: (value: string) => void;
  sheetTitle: string;
  value: string;
}) {
  const { date, hour, minute } = splitDateTimeLocal(value);

  function updateDate(nextDate: string) {
    onChange(combineDateTimeLocal(nextDate, hour || "09", minute || "00"));
  }

  function updateHour(nextHour: string) {
    onChange(combineDateTimeLocal(date, nextHour, minute || "00"));
  }

  function updateMinute(nextMinute: string) {
    onChange(combineDateTimeLocal(date, hour || "09", nextMinute));
  }

  return (
    <div className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <div className="grid gap-3 md:grid-cols-[1fr_92px_92px]">
        <WheelDatePicker
          value={date}
          onChange={updateDate}
          buttonClassName={inputClassName}
          minYear={minYear}
          maxYear={maxYear}
          defaultYear={new Date().getFullYear()}
          sheetTitle={sheetTitle}
        />
        <label className="grid gap-1">
          <span className="sr-only">ชั่วโมง</span>
          <select value={hour} onChange={(event) => updateHour(event.target.value)} className={selectClassName}>
            <option value="">ชั่วโมง</option>
            {hourOptions.map((option) => (
              <option key={`${label}-hour-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="sr-only">นาที</span>
          <select value={minute} onChange={(event) => updateMinute(event.target.value)} className={selectClassName}>
            <option value="">นาที</option>
            {minuteOptions.map((option) => (
              <option key={`${label}-minute-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Select({
  children,
  defaultValue,
  label,
  name,
}: {
  children: ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <select name={name} defaultValue={defaultValue} className={selectClassName}>
        {children}
      </select>
    </label>
  );
}

function ControlledSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClassName}>
        {children}
      </select>
    </label>
  );
}

function Textarea({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <textarea name={name} placeholder={placeholder} defaultValue={defaultValue ?? ""} className={textareaClassName} />
    </label>
  );
}

function RangePreview({ max, min }: { max: string; min: string }) {
  const range = formatOpenRange(min, max);

  return (
    <span className="w-fit rounded-full border border-[#27345b] bg-[#101832] px-2.5 py-1 text-xs font-semibold text-[#aab4da]">
      {range}
    </span>
  );
}

function ActionMessage({ state }: { state: TournamentActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-md border p-3 text-sm ${
        state.status === "error"
          ? "border-[#4a1724] bg-[#2a1020] text-[#ffb0bd]"
          : "border-[#073d36] bg-[#071f20] text-[#42e0b3]"
      }`}
    >
      {state.message}
    </div>
  );
}

function toInitialDivisionDrafts(divisions?: DivisionRecord[]) {
  if (!divisions || divisions.length === 0) {
    return [createEmptyDivisionDraft("new-1")];
  }

  return divisions.map((division, index) => ({
    clientId: division.id || `existing-${index + 1}`,
    id: division.id,
    name: division.name,
    minPowerLevel: stringifyOptionalNumber(division.minPowerLevel),
    maxPowerLevel: stringifyOptionalNumber(division.maxPowerLevel),
    minAge: stringifyOptionalNumber(division.minAge),
    maxAge: stringifyOptionalNumber(division.maxAge),
    feeAmount: String(division.feeAmount),
    maxPlayers: stringifyOptionalNumber(division.maxPlayers),
    timeSlotLabel: normalizeTimeSlot(division.timeSlotLabel),
  }));
}

function toDivisionPayload(division: DivisionDraft) {
  return {
    id: division.id,
    name: division.name,
    minPowerLevel: division.minPowerLevel,
    maxPowerLevel: division.maxPowerLevel,
    minAge: division.minAge,
    maxAge: division.maxAge,
    feeAmount: division.feeAmount,
    maxPlayers: division.maxPlayers,
    timeSlotLabel: division.timeSlotLabel,
  };
}

function createEmptyDivisionDraft(clientId: string): DivisionDraft {
  return {
    clientId,
    name: "",
    minPowerLevel: "",
    maxPowerLevel: "",
    minAge: "",
    maxAge: "",
    feeAmount: "0",
    maxPlayers: "",
    timeSlotLabel: "เช้า",
  };
}

function stringifyOptionalNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function normalizeTimeSlot(value: string | null) {
  if (value && timeSlotOptions.includes(value as (typeof timeSlotOptions)[number])) {
    return value;
  }

  return "เช้า";
}

function formatOpenRange(min: string, max: string) {
  if (!min.trim() && !max.trim()) {
    return "Open";
  }

  return `${min.trim() || "Open"} - ${max.trim() || "Open"}`;
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function splitDateTimeLocal(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return {
      date: "",
      hour: "09",
      minute: "00",
    };
  }

  return {
    date: match[1],
    hour: match[2],
    minute: match[3],
  };
}

function combineDateTimeLocal(date: string, hour: string, minute: string) {
  if (!date) {
    return "";
  }

  return `${date}T${hour || "09"}:${minute || "00"}`;
}
