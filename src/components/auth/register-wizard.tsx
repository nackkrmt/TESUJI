"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Search, UserRound } from "lucide-react";
import { selfDeclaredRankOptions } from "@/lib/auth/rank-options";
import {
  isTitlePreset,
  nationalityOptions,
  TITLE_OTHER,
  titleEnMap,
  titlePresets,
} from "@/lib/auth/profile-options";
import { InstituteSearchField } from "@/components/auth/institute-search-field";
import { SearchableSelect } from "@/components/mobile/searchable-select";
import { WheelDatePicker } from "@/components/mobile/wheel-date-picker";
import {
  FieldLabel,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  selectClassName,
} from "@/components/mobile/mobile-shell";

type ProfileForm = {
  titleTh: string;
  titleEn: string;
  firstNameTh: string;
  middleNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  middleNameEn: string;
  lastNameEn: string;
  gender: "male" | "female" | "unspecified";
  dateOfBirth: string;
  identityDocumentType: "national_id" | "passport";
  identityDocumentValue: string;
  nationality: string;
  instituteName: string;
  phone: string;
  pdpaConsent: boolean;
};

type Candidate = {
  id: string;
  source: "dan" | "kyu" | "award";
  firstNameTh: string;
  lastNameTh: string;
  rank: string;
  powerLevel: number;
  rating: number | null;
  matchType: "exact" | "normalized" | "fuzzy";
  similarityScore: number;
  evidence: string[];
};

type RankResult =
  | { status: "matched"; candidate: Candidate; candidates: Candidate[] }
  | { status: "multiple"; candidates: Candidate[] }
  | { status: "not_found"; candidates: [] };

const initialProfile: ProfileForm = {
  titleTh: "",
  titleEn: "",
  firstNameTh: "",
  middleNameTh: "",
  lastNameTh: "",
  firstNameEn: "",
  middleNameEn: "",
  lastNameEn: "",
  gender: "unspecified",
  dateOfBirth: "",
  identityDocumentType: "national_id",
  identityDocumentValue: "",
  nationality: "Thai",
  instituteName: "",
  phone: "",
  pdpaConsent: false,
};

export function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [titleOption, setTitleOption] = useState("");
  const [hasMiddleName, setHasMiddleName] = useState(false);
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selfRank, setSelfRank] = useState("15 Kyu");
  const [role, setRole] = useState<"player" | "coach">("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCandidate = useMemo(
    () => rankResult?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [rankResult, selectedCandidateId],
  );

  function updateProfile<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function validateProfile(): string | null {
    if (!profile.titleTh.trim()) {
      return "กรุณาเลือกคำนำหน้า";
    }
    if (!profile.titleEn.trim()) {
      return "กรุณาระบุคำนำหน้าภาษาอังกฤษ";
    }
    if (!profile.firstNameTh.trim()) {
      return "กรุณากรอกชื่อไทย";
    }
    if (!profile.lastNameTh.trim()) {
      return "กรุณากรอกนามสกุลไทย";
    }
    if (!profile.firstNameEn.trim()) {
      return "กรุณากรอกชื่ออังกฤษ";
    }
    if (!profile.lastNameEn.trim()) {
      return "กรุณากรอกนามสกุลอังกฤษ";
    }
    if (hasMiddleName && (!profile.middleNameTh.trim() || !profile.middleNameEn.trim())) {
      return "กรุณากรอกชื่อกลาง TH/EN หรือปิดสวิตช์ชื่อกลาง";
    }
    if (!profile.dateOfBirth) {
      return "กรุณาเลือกวันเกิด";
    }
    if (!profile.identityDocumentValue.trim()) {
      return "กรุณากรอกเลขบัตรหรือ Passport";
    }
    if (!profile.nationality.trim()) {
      return "กรุณาเลือกสัญชาติ";
    }
    if (!profile.phone.trim()) {
      return "กรุณากรอกเบอร์โทร";
    }
    if (!profile.pdpaConsent) {
      return "กรุณายอมรับเงื่อนไข PDPA ก่อนดำเนินการต่อ";
    }
    return null;
  }

  function searchRank() {
    const validationMessage = validateProfile();

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/rank/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstNameTh: profile.firstNameTh,
          lastNameTh: profile.lastNameTh,
        }),
      });
      const result = (await response.json()) as RankResult | { error?: string };

      if (!response.ok || isErrorResult(result)) {
        setMessage(isErrorResult(result) ? result.error ?? "ค้นหา rank ไม่สำเร็จ" : "ค้นหา rank ไม่สำเร็จ");
        return;
      }

      setRankResult(result);
      setSelectedCandidateId(
        result.status === "not_found" ? "" : result.candidates[0]?.id ?? "",
      );
      setStep(2);
    });
  }

  function goToRoleStep() {
    if (rankResult?.status !== "not_found" && !selectedCandidateId) {
      setMessage("กรุณาเลือก record ที่ตรงกับคุณ");
      return;
    }

    setMessage(null);
    setStep(3);
  }

  function goToAccountStep() {
    setMessage(null);
    setStep(4);
  }

  function submitSignup() {
    setMessage(null);

    if (!email || !password) {
      setMessage("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          rankSelection:
            rankResult?.status === "not_found"
              ? { type: "self", rank: selfRank }
              : { type: "matched", candidateId: selectedCandidateId },
          role,
          credentials: { email, password },
          remember,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "สมัครสมาชิกไม่สำเร็จ");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepHeader step={step} />

      {step === 1 ? (
        <ProfileStep
          profile={profile}
          updateProfile={updateProfile}
          titleOption={titleOption}
          setTitleOption={setTitleOption}
          hasMiddleName={hasMiddleName}
          setHasMiddleName={setHasMiddleName}
        />
      ) : step === 2 ? (
        <RankStep
          rankResult={rankResult}
          selectedCandidateId={selectedCandidateId}
          setSelectedCandidateId={setSelectedCandidateId}
          selfRank={selfRank}
          setSelfRank={setSelfRank}
        />
      ) : step === 3 ? (
        <RoleStep role={role} setRole={setRole} />
      ) : (
        <AccountStep
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          remember={remember}
          setRemember={setRemember}
          role={role}
          selectedCandidate={selectedCandidate}
          selfRank={selfRank}
          isSelfRank={rankResult?.status === "not_found"}
        />
      )}

      {message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#4a1724] bg-[#2a1020] p-3 text-sm text-[#ffb0bd]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-auto grid gap-3 pt-2">
        {step === 1 ? (
          <button type="button" className={primaryButtonClassName} onClick={searchRank} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="mr-2 h-4 w-4" aria-hidden />
            )}
            {isPending ? "กำลังค้นหา..." : "ถัดไป: ค้นหา Rank"}
          </button>
        ) : step === 2 ? (
          <>
            <button type="button" className={primaryButtonClassName} onClick={goToRoleStep}>
              ถัดไป: เลือก Role
            </button>
            <button type="button" className={secondaryButtonClassName} onClick={() => setStep(1)}>
              กลับไปแก้ Profile
            </button>
          </>
        ) : step === 3 ? (
          <>
            <button type="button" className={primaryButtonClassName} onClick={goToAccountStep}>
              ถัดไป: ตั้งค่าบัญชี
            </button>
            <button type="button" className={secondaryButtonClassName} onClick={() => setStep(2)}>
              กลับไปเลือก Rank
            </button>
          </>
        ) : (
          <>
            <button type="button" className={primaryButtonClassName} onClick={submitSignup} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  กำลังสมัคร...
                </>
              ) : (
                "สมัครสมาชิก"
              )}
            </button>
            <button type="button" className={secondaryButtonClassName} onClick={() => setStep(3)}>
              กลับไปเลือก Role
            </button>
          </>
        )}
      </div>

      <p className="text-center text-sm text-[#8390bd]">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-semibold text-[#8c91ff]">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

function StepHeader({ step }: { step: number }) {
  const labels = ["Profile", "Rank", "Role", "Account"];

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-2">
        {labels.map((label, index) => {
          const active = step >= index + 1;

          return (
            <div key={label} className="min-w-0">
              <div className={`h-1.5 rounded-full ${active ? "bg-[#6c72ff]" : "bg-[#27345b]"}`} />
              <p className={`mt-1 truncate text-[11px] ${active ? "text-white" : "text-[#526087]"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileStep({
  profile,
  updateProfile,
  titleOption,
  setTitleOption,
  hasMiddleName,
  setHasMiddleName,
}: {
  profile: ProfileForm;
  updateProfile: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
  titleOption: string;
  setTitleOption: (value: string) => void;
  hasMiddleName: boolean;
  setHasMiddleName: (value: boolean) => void;
}) {
  const isCustomTitle = titleOption === TITLE_OTHER;

  function handleTitleOption(option: string) {
    setTitleOption(option);
    if (option === TITLE_OTHER) {
      updateProfile("titleTh", "");
      updateProfile("titleEn", "");
    } else if (isTitlePreset(option)) {
      updateProfile("titleTh", option);
      updateProfile("titleEn", titleEnMap[option]);
    }
  }

  function handleMiddleToggle(next: boolean) {
    setHasMiddleName(next);
    if (!next) {
      updateProfile("middleNameTh", "");
      updateProfile("middleNameEn", "");
    }
  }

  function handleNationalityChange(value: string) {
    updateProfile("nationality", value);
    // Thai citizens use a national ID; everyone else uses a passport.
    const nextType: ProfileForm["identityDocumentType"] =
      value === "Thai" ? "national_id" : "passport";
    if (nextType !== profile.identityDocumentType) {
      updateProfile("identityDocumentType", nextType);
      updateProfile("identityDocumentValue", "");
    }
  }

  function switchDocType(next: ProfileForm["identityDocumentType"]) {
    if (next !== profile.identityDocumentType) {
      updateProfile("identityDocumentType", next);
      updateProfile("identityDocumentValue", "");
    }
  }

  const isNationalId = profile.identityDocumentType === "national_id";

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <FieldLabel>คำนำหน้า<span className="text-[#ff8fa0]"> *</span></FieldLabel>
        <select
          className={selectClassName}
          value={titleOption}
          onChange={(event) => handleTitleOption(event.target.value)}
        >
          <option value="" disabled>
            เลือกคำนำหน้า
          </option>
          {titlePresets.map((title) => (
            <option key={title} value={title}>
              {title} ({titleEnMap[title]})
            </option>
          ))}
          <option value={TITLE_OTHER}>{TITLE_OTHER}</option>
        </select>
      </div>
      {isCustomTitle ? (
        <div className="-mt-1 grid gap-3 rounded-md border border-[#27345b] bg-[#0c1430] p-3">
          <p className="text-xs leading-5 text-[#8390bd]">ระบุคำนำหน้าเองทั้งภาษาไทยและอังกฤษ</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="ไทย"
              value={profile.titleTh}
              onChange={(value) => updateProfile("titleTh", value)}
              placeholder="เช่น ดร."
              focusOnMount
              required
            />
            <TextField
              label="อังกฤษ"
              value={profile.titleEn}
              onChange={(value) => updateProfile("titleEn", value)}
              placeholder="e.g. Dr."
              required
            />
          </div>
        </div>
      ) : null}

      <TextField label="ชื่อไทย" value={profile.firstNameTh} onChange={(value) => updateProfile("firstNameTh", value)} required />
      <TextField label="นามสกุลไทย" value={profile.lastNameTh} onChange={(value) => updateProfile("lastNameTh", value)} required />
      <TextField label="First name EN" value={profile.firstNameEn} onChange={(value) => updateProfile("firstNameEn", value)} required />
      <TextField label="Last name EN" value={profile.lastNameEn} onChange={(value) => updateProfile("lastNameEn", value)} required />

      <ToggleSwitch checked={hasMiddleName} onChange={handleMiddleToggle} label="มีชื่อกลาง" />
      {hasMiddleName ? (
        <>
          <TextField label="ชื่อกลางไทย" value={profile.middleNameTh} onChange={(value) => updateProfile("middleNameTh", value)} required />
          <TextField label="Middle name EN" value={profile.middleNameEn} onChange={(value) => updateProfile("middleNameEn", value)} required />
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <FieldLabel>เพศ</FieldLabel>
          <select
            className={selectClassName}
            value={profile.gender}
            onChange={(event) => updateProfile("gender", event.target.value as ProfileForm["gender"])}
          >
            <option value="unspecified">ไม่ระบุ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </select>
        </div>
        <div className="grid gap-2">
          <FieldLabel>วันเกิด<span className="text-[#ff8fa0]"> *</span></FieldLabel>
          <WheelDatePicker
            value={profile.dateOfBirth}
            onChange={(value) => updateProfile("dateOfBirth", value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <FieldLabel>สัญชาติ<span className="text-[#ff8fa0]"> *</span></FieldLabel>
        <SearchableSelect
          value={profile.nationality}
          onChange={handleNationalityChange}
          options={nationalityOptions}
          placeholder="เลือกสัญชาติ"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel>
          {isNationalId ? "เลขบัตรประชาชน" : "หมายเลขหนังสือเดินทาง (Passport)"}
          <span className="text-[#ff8fa0]"> *</span>
        </FieldLabel>
        <input
          className={inputClassName}
          value={profile.identityDocumentValue}
          onChange={(event) => updateProfile("identityDocumentValue", event.target.value)}
          inputMode={isNationalId ? "numeric" : "text"}
          maxLength={isNationalId ? 13 : undefined}
          placeholder={isNationalId ? "เลขบัตร 13 หลัก" : "เลขที่หนังสือเดินทาง"}
        />
        {isNationalId ? (
          <button
            type="button"
            onClick={() => switchDocType("passport")}
            className="justify-self-start text-xs font-medium text-[#8c91ff] hover:underline"
          >
            ไม่มีบัตรประชาชน? ใช้พาสปอร์ตแทน
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchDocType("national_id")}
            className="justify-self-start text-xs font-medium text-[#8c91ff] hover:underline"
          >
            ใช้เลขบัตรประชาชนแทน
          </button>
        )}
      </div>

      <InstituteSearchField
        value={profile.instituteName}
        onChange={(value) => updateProfile("instituteName", value)}
      />
      <TextField label="เบอร์โทร" value={profile.phone} onChange={(value) => updateProfile("phone", value)} required />

      <label className="flex items-start gap-3 rounded-md border border-[#27345b] bg-[#101832] p-3">
        <input
          type="checkbox"
          checked={profile.pdpaConsent}
          onChange={(event) => updateProfile("pdpaConsent", event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#6c72ff]"
        />
        <span className="text-xs leading-5 text-[#aab4da]">
          ข้าพเจ้ายินยอมให้ TESUJI จัดเก็บและประมวลผลข้อมูลส่วนบุคคล รวมถึงเลขบัตรประชาชน
          เพื่อยืนยันตัวตนและจัดการการแข่งขัน ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
        </span>
      </label>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1.5"
    >
      <span className="text-sm text-[#dce3ff]">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#6c72ff]" : "bg-[#3a4467]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function RankStep({
  rankResult,
  selectedCandidateId,
  setSelectedCandidateId,
  selfRank,
  setSelfRank,
}: {
  rankResult: RankResult | null;
  selectedCandidateId: string;
  setSelectedCandidateId: (value: string) => void;
  selfRank: string;
  setSelfRank: (value: string) => void;
}) {
  if (!rankResult) {
    return null;
  }

  if (rankResult.status === "not_found") {
    return (
      <div className="grid gap-4">
        <div className="rounded-md border border-[#443013] bg-[#22190c] p-4 text-sm leading-6 text-[#ffc66d]">
          ไม่พบชื่อในฐานข้อมูล DAN/KYU/AWARD กรุณาเลือกระดับฝีมือตัวเอง ระบบจะส่งให้ Admin ตรวจภายหลัง
        </div>
        <div className="grid gap-2">
          <FieldLabel>เลือกระดับฝีมือ</FieldLabel>
          <select className={selectClassName} value={selfRank} onChange={(event) => setSelfRank(event.target.value)}>
            {selfDeclaredRankOptions.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-[#073d36] bg-[#071f20] p-4 text-sm leading-6 text-[#42e0b3]">
        เจอข้อมูลในฐานข้อมูลจริง กรุณาเลือก record ที่ตรงกับคุณ
      </div>
      {rankResult.candidates.map((candidate) => (
        <label
          key={candidate.id}
          className={`block rounded-md border p-4 transition ${
            selectedCandidateId === candidate.id
              ? "border-[#6c72ff] bg-[#17244d]"
              : "border-[#27345b] bg-[#101832]"
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="candidate"
              checked={selectedCandidateId === candidate.id}
              onChange={() => setSelectedCandidateId(candidate.id)}
              className="mt-1 h-4 w-4 accent-[#6c72ff]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-white">
                  {candidate.firstNameTh} {candidate.lastNameTh}
                </p>
                <span className="rounded-full bg-[#0a3448] px-2 py-0.5 text-xs font-semibold text-[#58d8ff]">
                  {candidate.source.toUpperCase()}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#dce3ff]">
                {candidate.rank} · power {candidate.powerLevel}
              </p>
              <EvidenceList evidence={candidate.evidence} />
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

function RoleStep({
  role,
  setRole,
}: {
  role: "player" | "coach";
  setRole: (role: "player" | "coach") => void;
}) {
  return (
    <div className="grid gap-3">
      <RoleButton
        active={role === "player"}
        title="Player"
        detail="สมัครแข่งด้วยโปรไฟล์ของตัวเอง"
        onClick={() => setRole("player")}
      />
      <RoleButton
        active={role === "coach"}
        title="Coach"
        detail="มีโปรไฟล์นักกีฬาของตัวเอง และขอสิทธิ์ Coach เพื่อดูแลผู้เล่นอื่น"
        onClick={() => setRole("coach")}
      />
      {role === "coach" ? (
        <div className="rounded-md border border-[#443013] bg-[#22190c] p-4 text-sm leading-6 text-[#ffc66d]">
          หลังสมัครคุณจะได้ role Player ทันที ส่วนสิทธิ์ Coach จะเป็น pending กรุณาติดต่อ Admin เพื่อยืนยันตัว
        </div>
      ) : null}
    </div>
  );
}

function AccountStep({
  email,
  setEmail,
  password,
  setPassword,
  remember,
  setRemember,
  role,
  selectedCandidate,
  selfRank,
  isSelfRank,
}: {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  remember: boolean;
  setRemember: (value: boolean) => void;
  role: "player" | "coach";
  selectedCandidate: Candidate | null;
  selfRank: string;
  isSelfRank: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-[#27345b] bg-[#101832] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 text-[#42e0b3]" aria-hidden />
          สรุปก่อนสมัคร
        </div>
        <p className="mt-3 text-sm text-[#dce3ff]">Role: {role === "coach" ? "Coach pending + Player" : "Player"}</p>
        <p className="mt-1 text-sm text-[#dce3ff]">
          Rank: {isSelfRank ? `${selfRank} (pending)` : `${selectedCandidate?.rank ?? "-"} (verified)`}
        </p>
      </div>

      <TextField label="อีเมล" type="email" value={email} onChange={setEmail} />
      <TextField label="รหัสผ่าน" type="password" value={password} onChange={setPassword} />
      <label className="flex items-center gap-2 text-sm text-[#dce3ff]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-4 w-4 rounded border-[#27345b] accent-[#6c72ff]"
        />
        จดจำฉันหลังสมัคร
      </label>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  optional,
  required,
  placeholder,
  focusOnMount,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  optional?: boolean;
  required?: boolean;
  placeholder?: string;
  focusOnMount?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;

  useEffect(() => {
    if (focusOnMount) {
      inputRef.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <div className="grid gap-2">
      <FieldLabel>
        {label}
        {required ? <span className="text-[#ff8fa0]"> *</span> : null}
        {optional ? <span className="font-normal text-[#526087]"> ไม่บังคับ</span> : null}
      </FieldLabel>
      <div className="relative">
        <input
          ref={inputRef}
          className={isPassword ? `${inputClassName} pr-12` : inputClassName}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((current) => !current)}
            aria-label={reveal ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-[#8390bd] outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-[#6c72ff]"
          >
            {reveal ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RoleButton({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-md border p-4 text-left transition ${
        active ? "border-[#6c72ff] bg-[#17244d]" : "border-[#27345b] bg-[#101832]"
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#202a49] text-[#8c91ff]">
        <UserRound className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block font-semibold text-white">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-[#8390bd]">{detail}</span>
      </span>
    </button>
  );
}

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) {
    return <p className="mt-2 text-xs text-[#7480aa]">ไม่มีรายละเอียดเพิ่มเติม</p>;
  }

  return (
    <ul className="mt-2 grid gap-1 text-xs leading-5 text-[#aab4da]">
      {evidence.map((item) => (
        <li key={item}>- {item}</li>
      ))}
    </ul>
  );
}

function isErrorResult(result: RankResult | { error?: string }): result is { error?: string } {
  return "error" in result;
}
