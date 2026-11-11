import { Avatar } from "@/components/avatar";
import { Card, ComingSoon, PageHeader } from "@/components/page-header";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { AddMemberForm, FamilyNameForm, MemberEditor } from "./forms";

export const metadata = { title: "Parent dashboard" };

export default async function ParentPage() {
  const { family, profile: me } = await requireParent();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, family_id, display_name, role, color, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  return (
    <div className="space-y-4">
      <PageHeader title="Parent dashboard" subtitle={family.name} />

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Family members</h2>
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => (
            <li key={m.id} className="py-3 first:pt-0 last:pb-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Avatar name={m.display_name} color={m.color} />
                  <div className="flex-1">
                    <p className="font-medium text-ink">
                      {m.display_name}
                      {m.id === me.id && <span className="text-muted"> (you)</span>}
                    </p>
                    <p className="text-sm text-muted">{m.role === "parent" ? "Parent" : "Kid"}</p>
                  </div>
                  <span className="text-sm font-medium text-brand-strong group-open:hidden">Edit</span>
                  <span className="hidden text-sm font-medium text-muted group-open:inline">Close</span>
                </summary>
                <div className="mt-4">
                  <MemberEditor member={m} isMe={m.id === me.id} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Add a family member</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Choose a starting password and share it with them. They can change it in My settings.
        </p>
        <AddMemberForm />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Family name</h2>
        <FamilyNameForm name={family.name} />
      </Card>

      <ComingSoon
        stage={2}
        items={["Each kid's progress at a glance", "Goals waiting for your approval", "Override check-offs"]}
      />
    </div>
  );
}
