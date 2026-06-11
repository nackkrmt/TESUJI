import { ZodError } from "zod";
import {
  exportAdminRegistrationCsv,
  type AdminRegistrationStatus,
} from "@/lib/admin/registrations";

export const dynamic = "force-dynamic";

const validStatuses = new Set<AdminRegistrationStatus>([
  "pending_payment",
  "pending_verify",
  "confirmed",
  "waiting_list",
  "cancelled",
  "expired",
  "rejected",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId");
  const divisionId = url.searchParams.get("divisionId");

  if (!tournamentId) {
    return Response.json({ error: "tournamentId is required." }, { status: 400 });
  }

  try {
    const statuses = getStatuses(url.searchParams);
    const exportFile = await exportAdminRegistrationCsv({
      divisionId,
      statuses,
      tournamentId,
    });

    return new Response(exportFile.content, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
        "Content-Type": exportFile.contentType,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = error instanceof ZodError ? 400 : message.includes("not found") ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}

function getStatuses(searchParams: URLSearchParams) {
  const rawValues = searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (rawValues.length === 0) {
    return undefined;
  }

  const statuses: AdminRegistrationStatus[] = [];
  for (const value of rawValues) {
    if (!validStatuses.has(value as AdminRegistrationStatus)) {
      throw new ZodError([
        {
          code: "custom",
          message: `Invalid registration status: ${value}`,
          path: ["status"],
          input: value,
        },
      ]);
    }

    statuses.push(value as AdminRegistrationStatus);
  }

  return statuses;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid export request.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Registration export failed.";
}
