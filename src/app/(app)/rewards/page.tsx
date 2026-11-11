import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <>
      <PageHeader title="Rewards" subtitle="Earn points and spend them on rewards." />
      <ComingSoon
        stage={3}
        items={["Points, streaks and badges", "The family reward store", "Request a reward for a parent to approve"]}
      />
    </>
  );
}
