import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Family and school events, plus school lunch." />
      <ComingSoon
        stage={5}
        items={[
          "Your Apple calendars and the Noblesville Schools calendar",
          "Each kid's school lunch for every day",
        ]}
      />
    </>
  );
}
