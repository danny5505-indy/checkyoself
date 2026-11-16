import { ListForm } from "@/components/lists/list-form";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { loadFamily } from "@/lib/family";

export const metadata = { title: "New list" };

export default async function NewListPage() {
  const { profile } = await requireMember();
  const others = (await loadFamily()).filter((m) => m.id !== profile.id);
  return (
    <>
      <PageHeader title="New list" />
      <ListForm others={others} />
    </>
  );
}
