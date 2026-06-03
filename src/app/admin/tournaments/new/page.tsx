import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TournamentForm } from "@/components/admin/tournament-forms";

export const dynamic = "force-dynamic";

export default function NewTournamentPage() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <Link
          href="/admin/tournaments"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to tournaments
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-white">
          สร้างรายการแข่งขัน
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8390bd]">
          สร้างเป็น draft ก่อน จากนั้นเข้าไปเพิ่ม divisions และ promo codes
        </p>
      </header>

      <TournamentForm mode="create" />
    </div>
  );
}
