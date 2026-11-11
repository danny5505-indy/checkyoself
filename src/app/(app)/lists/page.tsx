import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata = { title: "Lists" };

export default function ListsPage() {
  return (
    <>
      <PageHeader title="Lists" subtitle="Groceries, packing lists, wish lists and to-dos." />
      <ComingSoon
        stage={4}
        items={[
          "Shared grocery list that updates live",
          "Custom lists shared with whoever you choose",
          "Personal to-dos",
        ]}
      />
    </>
  );
}
