import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  DivisionForm,
  PromoCodeForm,
  TournamentForm,
  TournamentStatusActions,
} from "@/components/admin/tournament-forms";
import { getAdminTournamentDetail } from "@/lib/tournaments/admin";

export const dynamic = "force-dynamic";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getAdminTournamentDetail(id);

  if (!tournament) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/tournaments"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#8c91ff] transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to tournaments
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-white">
            {tournament.titleTh}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8390bd]">
            จัดการข้อมูลกลาง รุ่นแข่งขัน และ promo codes ของรายการนี้
          </p>
        </div>
        {tournament.status !== "draft" ? (
          <Link
            href={`/tournaments/${tournament.id}`}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-[#27345b] px-4 py-3 text-sm font-semibold text-[#dce3ff] transition hover:border-[#6c72ff] hover:text-white"
          >
            Public detail
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </header>

      <TournamentStatusActions tournament={tournament} />
      <TournamentForm mode="update" tournament={tournament} />

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Divisions</h2>
          <p className="mt-1 text-sm text-[#8390bd]">
            เพิ่มอย่างน้อยหนึ่ง active division ก่อนเปลี่ยนสถานะเป็น open
          </p>
        </div>
        <DivisionForm tournamentId={tournament.id} />
        {tournament.divisions.map((division) => (
          <DivisionForm key={division.id} tournamentId={tournament.id} division={division} />
        ))}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Promo Codes</h2>
          <p className="mt-1 text-sm text-[#8390bd]">
            Promo usage จะนับจริงใน registration/payment flow ของ Sprint 5
          </p>
        </div>
        <PromoCodeForm tournamentId={tournament.id} divisions={tournament.divisions} />
        {tournament.promoCodes.map((promoCode) => (
          <PromoCodeForm
            key={promoCode.id}
            tournamentId={tournament.id}
            divisions={tournament.divisions}
            promoCode={promoCode}
          />
        ))}
      </section>
    </div>
  );
}
