"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  createTournamentAction,
  deleteDraftTournamentAction,
  setTournamentStatusAction,
  updateTournamentAction,
  upsertDivisionAction,
  upsertPromoCodeAction,
  type TournamentActionState,
} from "@/app/admin/tournaments/actions";
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
  "min-h-24 rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#526087] focus-visible:ring-2 focus-visible:ring-[#6c72ff]";
const selectClassName =
  "min-h-11 cursor-pointer rounded-md border border-[#27345b] bg-[#0a1128] px-3 py-2 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[#6c72ff]";

export function TournamentForm({
  mode,
  tournament,
}: {
  mode: "create" | "update";
  tournament?: TournamentRecord;
}) {
  const action = mode === "create" ? createTournamentAction : updateTournamentAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-[#202a49] bg-[#101832] p-5">
      {tournament ? <input type="hidden" name="tournamentId" value={tournament.id} /> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7378ff]">
            {mode === "create" ? "Create Tournament" : "Tournament Details"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {mode === "create" ? "New draft tournament" : tournament?.titleTh}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#8390bd]">
            บันทึกข้อมูลรายการจริงลง Supabase ก่อนเปิดระบบสมัคร
          </p>
        </div>
        {state.id && mode === "create" ? (
          <Link
            href={`/admin/tournaments/${state.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#27345b] px-4 py-2 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
          >
            Open draft
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="ชื่อรายการ TH" name="titleTh" required defaultValue={tournament?.titleTh} />
        <Field label="Title EN" name="titleEn" defaultValue={tournament?.titleEn} />
        <Field label="สถานที่" name="venueName" defaultValue={tournament?.venueName} />
        <Field label="PromptPay ID" name="promptpayId" defaultValue={tournament?.promptpayId} />
        <Field label="ชื่อบัญชี PromptPay" name="promptpayName" defaultValue={tournament?.promptpayName} />
        <Field label="Banner URL" name="bannerUrl" defaultValue={tournament?.bannerUrl} />
        <Field label="Banner alt" name="bannerAlt" defaultValue={tournament?.bannerAlt} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DateField
          label="เปิดรับสมัคร"
          name="registrationOpensAt"
          defaultValue={tournament?.registrationOpensAt}
        />
        <DateField
          label="ปิดรับสมัคร"
          name="registrationClosesAt"
          defaultValue={tournament?.registrationClosesAt}
        />
        <DateField label="วันเริ่มแข่ง" name="eventStartsAt" defaultValue={tournament?.eventStartsAt} />
        <DateField label="วันจบรายการ" name="eventEndsAt" defaultValue={tournament?.eventEndsAt} />
      </div>

      <div className="mt-4 grid gap-4">
        <Textarea label="รายละเอียด" name="description" defaultValue={tournament?.description} />
        <Textarea label="ที่อยู่สถานที่" name="venueAddress" defaultValue={tournament?.venueAddress} />
      </div>

      <ActionMessage state={state} />

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#6c72ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7c82ff] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {mode === "create" ? "Create draft" : "Save tournament"}
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
        <Field label="Time slot" name="timeSlotLabel" defaultValue={division?.timeSlotLabel} />
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
  required,
  step,
  type = "text",
}: {
  defaultValue?: number | string | null;
  label: string;
  name: string;
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
        defaultValue={defaultValue ?? ""}
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
  return (
    <Field label={label} name={name} type="datetime-local" defaultValue={formatDateTimeLocal(defaultValue)} />
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

function Textarea({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#dce3ff]">
      {label}
      <textarea name={name} defaultValue={defaultValue ?? ""} className={textareaClassName} />
    </label>
  );
}

function ActionMessage({ state }: { state: TournamentActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-4 rounded-md border p-3 text-sm ${
        state.status === "error"
          ? "border-[#4a1724] bg-[#2a1020] text-[#ffb0bd]"
          : "border-[#073d36] bg-[#071f20] text-[#42e0b3]"
      }`}
    >
      {state.message}
    </div>
  );
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
