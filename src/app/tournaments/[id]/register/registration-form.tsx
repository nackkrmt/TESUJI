"use client";

import type { ReactNode } from "react";
import { useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Tag,
  Ticket,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  FieldLabel,
  inputClassName,
  primaryButtonClassName,
  selectClassName,
} from "@/components/mobile/mobile-shell";
import type {
  DivisionEligibility,
  RegistrationDivisionOption,
  RegistrationPlayerOption,
} from "@/lib/registrations/options";
import type { RegistrationTransactionResult } from "@/lib/registrations/transaction";
import { submitTournamentRegistration, type RegistrationActionState } from "./actions";

const initialState: RegistrationActionState = {
  status: "idle",
  message: "",
  result: null,
};

export function RegistrationForm({
  tournamentId,
  players,
  divisions,
}: {
  tournamentId: string;
  players: RegistrationPlayerOption[];
  divisions: RegistrationDivisionOption[];
}) {
  const [selectedProfileId, setSelectedProfileId] = useState(players[0]?.profileId ?? "");
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);
  const [state, formAction, isPending] = useActionState(submitTournamentRegistration, initialState);

  const selectedPlayer = players.find((player) => player.profileId === selectedProfileId) ?? players[0];
  const selectedDivisions = useMemo(
    () => divisions.filter((division) => selectedDivisionIds.includes(division.id)),
    [divisions, selectedDivisionIds],
  );
  const selectedConflict = useMemo(
    () => findSelectedDivisionConflict(selectedDivisions),
    [selectedDivisions],
  );
  const ineligibleSelected = selectedDivisions
    .map((division) => ({
      division,
      eligibility: getEligibility(division, selectedProfileId),
    }))
    .filter((item) => !item.eligibility.eligible);
  const canSubmit =
    Boolean(selectedProfileId) &&
    selectedDivisionIds.length > 0 &&
    ineligibleSelected.length === 0 &&
    !selectedConflict &&
    state.status !== "success";

  function changePlayer(nextProfileId: string) {
    setSelectedProfileId(nextProfileId);
    setSelectedDivisionIds([]);
  }

  function toggleDivision(divisionId: string, checked: boolean) {
    setSelectedDivisionIds((current) =>
      checked ? [...current, divisionId] : current.filter((id) => id !== divisionId),
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="tournamentId" value={tournamentId} readOnly />
      <input type="hidden" name="playerProfileId" value={selectedProfileId} readOnly />

      <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <UserRound className="h-4 w-4 text-[#8c91ff]" aria-hidden />
          ผู้สมัคร
        </div>
        <label className="mt-4 grid gap-2">
          <FieldLabel>เลือกผู้เล่น</FieldLabel>
          <select
            value={selectedProfileId}
            onChange={(event) => changePlayer(event.target.value)}
            className={selectClassName}
            disabled={isPending || state.status === "success"}
          >
            {players.map((player) => (
              <option key={player.profileId} value={player.profileId}>
                {player.label}
              </option>
            ))}
          </select>
        </label>
        {selectedPlayer ? <PlayerSummary player={selectedPlayer} /> : null}
      </section>

      <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <UsersRound className="h-4 w-4 text-[#8c91ff]" aria-hidden />
            รุ่นแข่งขัน
          </div>
          <span className="text-xs font-semibold text-[#8390bd]">
            {selectedDivisionIds.length.toLocaleString("th-TH")} selected
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {divisions.map((division) => (
            <DivisionChoice
              key={division.id}
              division={division}
              eligibility={getEligibility(division, selectedProfileId)}
              checked={selectedDivisionIds.includes(division.id)}
              disabled={isPending || state.status === "success"}
              onChange={(checked) => toggleDivision(division.id, checked)}
            />
          ))}
        </div>
      </section>

      <PaymentSummary selectedDivisions={selectedDivisions} disabled={isPending || state.status === "success"} />

      {selectedConflict ? (
        <AlertPanel>
          รุ่นที่เลือกมีเวลาชนกัน: {selectedConflict.left.name} และ {selectedConflict.right.name}
        </AlertPanel>
      ) : null}

      {ineligibleSelected.length > 0 ? (
        <AlertPanel>
          {ineligibleSelected[0]?.division.name}: {ineligibleSelected[0]?.eligibility.reasons.join(", ")}
        </AlertPanel>
      ) : null}

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm leading-6 ${
            state.status === "error"
              ? "border-[#5a2030] bg-[#2a101c] text-[#ffb0bd]"
              : state.status === "success"
                ? "border-[#1d5a4c] bg-[#09241f] text-[#42e0b3]"
                : "border-[#27345b] bg-[#0a1128] text-[#8390bd]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {state.result ? <RegistrationResultPanel result={state.result} divisions={divisions} /> : null}

      <button type="submit" disabled={!canSubmit || isPending} className={primaryButtonClassName}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Ticket className="mr-2 h-4 w-4" aria-hidden />
        )}
        ยืนยันสมัคร
      </button>
    </form>
  );
}

function PlayerSummary({ player }: { player: RegistrationPlayerOption }) {
  return (
    <div className="mt-3 rounded-xl border border-[#27345b] bg-[#0a1128] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{player.label}</p>
          <p className="mt-1 text-xs leading-5 text-[#8390bd]">{player.detail}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
            player.rankStatus === "verified"
              ? "bg-[#073d36] text-[#42e0b3]"
              : "bg-[#443013] text-[#ffc66d]"
          }`}
        >
          {player.rankStatus}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#aab4da]">Power {player.powerLevel.toLocaleString("th-TH")}</p>
    </div>
  );
}

function DivisionChoice({
  checked,
  disabled,
  division,
  eligibility,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  division: RegistrationDivisionOption;
  eligibility: DivisionEligibility;
  onChange: (checked: boolean) => void;
}) {
  const isDisabled = disabled || !eligibility.eligible;

  return (
    <label
      className={`grid gap-3 rounded-xl border p-3 transition ${
        checked
          ? "border-[#6c72ff] bg-[#111b3d]"
          : eligibility.eligible
            ? "border-[#27345b] bg-[#0a1128]"
            : "border-[#27345b] bg-[#0a1128] opacity-65"
      } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer hover:border-[#6c72ff]"}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          name="divisionIds"
          value={division.id}
          checked={checked && eligibility.eligible}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-[#3a4770] bg-[#101832] accent-[#6c72ff] disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-white">{division.name}</p>
            <QuotaBadge division={division} />
          </div>
          {division.description ? (
            <p className="mt-1 text-xs leading-5 text-[#8390bd]">{division.description}</p>
          ) : null}
          <div className="mt-3 grid gap-1 text-xs leading-5 text-[#aab4da]">
            <p>{formatMoney(division.feeAmount)}</p>
            <p>
              Power {formatNumberRange(division.minPowerLevel, division.maxPowerLevel)} · อายุ{" "}
              {formatNumberRange(division.minAge, division.maxAge)}
            </p>
            <p>{division.timeSlotLabel || "ยังไม่ระบุเวลา"}</p>
          </div>
        </div>
      </div>

      {!eligibility.eligible ? (
        <p className="rounded-lg bg-[#1b2138] px-3 py-2 text-xs leading-5 text-[#ffc66d]">
          {eligibility.reasons.join(", ")}
        </p>
      ) : division.maxPlayers !== null && division.availableSlots === 0 ? (
        <p className="rounded-lg bg-[#1b2138] px-3 py-2 text-xs leading-5 text-[#ffc66d]">
          รุ่นเต็มแล้ว รายการนี้จะเข้าคิว waiting list
        </p>
      ) : null}
    </label>
  );
}

function QuotaBadge({ division }: { division: RegistrationDivisionOption }) {
  const availableSlots = division.availableSlots ?? 0;

  if (division.maxPlayers === null) {
    return (
      <span className="shrink-0 rounded-full bg-[#20255d] px-2 py-1 text-xs font-semibold text-[#8c91ff]">
        ไม่จำกัด
      </span>
    );
  }

  if (availableSlots > 0) {
    return (
      <span className="shrink-0 rounded-full bg-[#073d36] px-2 py-1 text-xs font-semibold text-[#42e0b3]">
        เหลือ {availableSlots.toLocaleString("th-TH")}
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#443013] px-2 py-1 text-xs font-semibold text-[#ffc66d]">
      waiting list
    </span>
  );
}

function PaymentSummary({
  disabled,
  selectedDivisions,
}: {
  disabled: boolean;
  selectedDivisions: RegistrationDivisionOption[];
}) {
  const payableDivisions = selectedDivisions.filter(
    (division) => division.maxPlayers === null || (division.availableSlots ?? 0) > 0,
  );
  const waitingListCount = selectedDivisions.length - payableDivisions.length;
  const subtotal = payableDivisions.reduce((sum, division) => sum + division.feeAmount, 0);

  return (
    <section className="rounded-2xl border border-[#27345b] bg-[#101832] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Tag className="h-4 w-4 text-[#8c91ff]" aria-hidden />
        สรุปยอด
      </div>

      <div className="mt-4 grid gap-2 text-sm leading-6 text-[#aab4da]">
        <SummaryLine label="รุ่นที่เลือก" value={`${selectedDivisions.length.toLocaleString("th-TH")} รุ่น`} />
        <SummaryLine label="ยอดก่อนส่วนลด" value={formatMoney(subtotal)} />
        {waitingListCount > 0 ? (
          <SummaryLine label="Waiting list" value={`${waitingListCount.toLocaleString("th-TH")} รุ่น`} />
        ) : null}
      </div>

      <label className="mt-4 grid gap-2">
        <FieldLabel>Promo code</FieldLabel>
        <input
          name="promoCode"
          className={inputClassName}
          placeholder="PROMO2026"
          autoComplete="off"
          disabled={disabled}
        />
      </label>
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </p>
  );
}

function AlertPanel({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#5a2030] bg-[#2a101c] p-3 text-sm leading-6 text-[#ffb0bd]">
      <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function RegistrationResultPanel({
  divisions,
  result,
}: {
  divisions: RegistrationDivisionOption[];
  result: RegistrationTransactionResult;
}) {
  const divisionById = new Map(divisions.map((division) => [division.id, division]));

  return (
    <section className="rounded-2xl border border-[#1d5a4c] bg-[#09241f] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#42e0b3]">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        ผลการสมัคร
      </div>
      <div className="mt-4 grid gap-3">
        {result.registrations.map((registration) => {
          const division = divisionById.get(registration.divisionId);
          return (
            <div key={registration.id} className="rounded-xl border border-[#1d5a4c] bg-[#0a1718] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{division?.name ?? registration.divisionId}</p>
                  <p className="mt-1 text-xs leading-5 text-[#8bcfbd]">
                    {formatRegistrationStatus(registration.status, registration.waitingListPosition)}
                  </p>
                </div>
                {registration.status === "pending_payment" ? (
                  <Clock className="h-4 w-4 shrink-0 text-[#ffc66d]" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#42e0b3]" aria-hidden />
                )}
              </div>
              <div className="mt-3 grid gap-1 text-xs leading-5 text-[#8bcfbd]">
                <SummaryLine label="ค่าสมัคร" value={formatMoney(registration.feeAmount)} />
                <SummaryLine label="ส่วนลด" value={formatMoney(registration.discountAmount)} />
                <SummaryLine label="ยอดสุทธิ" value={formatMoney(registration.finalFeeAmount)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 border-t border-[#1d5a4c] pt-4 text-sm leading-6 text-[#8bcfbd]">
        <SummaryLine label="ยอดรวม" value={formatMoney(result.totalFeeAmount)} />
        <SummaryLine label="ส่วนลดรวม" value={formatMoney(result.discountAmount)} />
        <SummaryLine label="ยอดชำระ" value={formatMoney(result.amountDue)} />
        {result.paymentOrderId ? <SummaryLine label="Payment order" value={shortId(result.paymentOrderId)} /> : null}
      </div>
    </section>
  );
}

function getEligibility(
  division: RegistrationDivisionOption,
  profileId: string,
): DivisionEligibility {
  return division.eligibilityByProfileId[profileId] ?? {
    eligible: false,
    reasons: ["ผู้เล่นนี้ยังสมัครรุ่นนี้ไม่ได้"],
  };
}

function findSelectedDivisionConflict(divisions: RegistrationDivisionOption[]) {
  for (const [leftIndex, left] of divisions.entries()) {
    for (const right of divisions.slice(leftIndex + 1)) {
      if (registrationTimeSlotsConflict(left, right)) {
        return { left, right };
      }
    }
  }

  return null;
}

function registrationTimeSlotsConflict(
  left: RegistrationDivisionOption,
  right: RegistrationDivisionOption,
) {
  if (left.startsAt && left.endsAt && right.startsAt && right.endsAt) {
    return (
      new Date(left.startsAt).getTime() < new Date(right.endsAt).getTime() &&
      new Date(right.startsAt).getTime() < new Date(left.endsAt).getTime()
    );
  }

  const leftLabel = normalizeTimeSlot(left.timeSlotLabel);
  const rightLabel = normalizeTimeSlot(right.timeSlotLabel);

  if (!leftLabel || !rightLabel) {
    return false;
  }

  return leftLabel === "full_day" || rightLabel === "full_day" || leftLabel === rightLabel;
}

function normalizeTimeSlot(label: string | null) {
  const normalized = label?.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (["full_day", "full day", "allday", "all_day", "เต็มวัน"].includes(normalized)) {
    return "full_day";
  }

  return normalized;
}

function formatNumberRange(min: number | null, max: number | null) {
  if (min === null && max === null) {
    return "Open";
  }

  return `${min ?? "Open"} - ${max ?? "Open"}`;
}

function formatMoney(value: number) {
  if (value === 0) {
    return "ฟรี";
  }

  return `${value.toLocaleString("th-TH")} บาท`;
}

function formatRegistrationStatus(status: string, waitingListPosition: number | null) {
  if (status === "pending_payment") {
    return "รอชำระเงิน";
  }

  if (status === "pending_verify") {
    return "รอตรวจสอบการชำระเงิน";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "waiting_list") {
    return waitingListPosition ? `Waiting list #${waitingListPosition.toLocaleString("th-TH")}` : "Waiting list";
  }

  return status;
}

function shortId(value: string) {
  return value.slice(0, 8);
}
