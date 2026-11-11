import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader title="Goals" subtitle="Your goals and the plans to reach them." />
      <ComingSoon
        stage={2}
        items={[
          "Create goals and build a plan for each one",
          "Kids' goals go to a parent for approval",
          "Choose Shared or Private for each goal",
          "On-track status and progress charts",
        ]}
      />
    </>
  );
}
