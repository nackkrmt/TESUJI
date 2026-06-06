import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type CurrentAccount = {
  userId: string;
  email: string;
  phone: string;
  activeRole: string;
  roles: Array<{ role: string; status: string }>;
  pendingRoleRequests: Array<{ requestedRole: string; status: string }>;
  profile: {
    id: string;
    nameTh: string;
    nameEn: string;
    rank: string;
    rankStatus: "verified" | "pending";
    instituteName: string | null;
  } | null;
};

type AccountRow = {
  id: string;
  email: string;
  phone: string;
  active_role: string;
};

type RoleRow = {
  role: string;
  status: string;
};

type RoleRequestRow = {
  requested_role: string;
  status: string;
};

type ProfileRow = {
  id: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  rank: string;
  rank_status: "verified" | "pending";
  institute_name: string | null;
};

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: account }, { data: roles }, { data: pendingRoleRequests }, { data: profile }] =
    await Promise.all([
      supabase.from("accounts").select("id,email,phone,active_role").eq("id", user.id).maybeSingle(),
      supabase.from("account_roles").select("role,status").eq("account_id", user.id),
      supabase
        .from("role_requests")
        .select("requested_role,status")
        .eq("account_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("player_profiles")
        .select(
          "id,first_name_th,last_name_th,first_name_en,last_name_en,rank,rank_status,institute_name",
        )
        .eq("account_id", user.id)
        .maybeSingle(),
    ]);

  if (!account) {
    return null;
  }

  const accountRow = account as AccountRow;
  const profileRow = profile as ProfileRow | null;

  return {
    userId: user.id,
    email: accountRow.email,
    phone: accountRow.phone,
    activeRole: accountRow.active_role,
    roles: ((roles ?? []) as RoleRow[]).map((role) => ({
      role: role.role,
      status: role.status,
    })),
    pendingRoleRequests: ((pendingRoleRequests ?? []) as RoleRequestRow[]).map((request) => ({
      requestedRole: request.requested_role,
      status: request.status,
    })),
    profile: profileRow
      ? {
          id: profileRow.id,
          nameTh: `${profileRow.first_name_th} ${profileRow.last_name_th}`,
          nameEn: `${profileRow.first_name_en} ${profileRow.last_name_en}`,
          rank: profileRow.rank,
          rankStatus: profileRow.rank_status,
          instituteName: profileRow.institute_name,
        }
      : null,
  };
}
