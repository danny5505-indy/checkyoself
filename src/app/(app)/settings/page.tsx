import { Avatar } from "@/components/avatar";
import { Card, PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { requireMember } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "My settings" };

export default async function SettingsPage() {
  const { profile, family, email } = await requireMember();

  return (
    <div className="space-y-4">
      <PageHeader title="My settings" />

      <Card className="flex items-center gap-3">
        <Avatar name={profile.display_name} color={profile.color} size="lg" />
        <div>
          <p className="text-lg font-semibold text-ink">{profile.display_name}</p>
          <p className="text-sm text-muted">
            {profile.role === "parent" ? "Parent" : "Kid"} · {family.name}
          </p>
          <p className="text-sm text-muted">{email}</p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Profile</h2>
        <ProfileForm name={profile.display_name} color={profile.color} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Change password</h2>
        <PasswordForm />
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Add to your Home Screen</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Open this site in Safari on your iPhone or iPad.</li>
          <li>Tap the Share button (the square with an arrow).</li>
          <li>Tap <span className="font-medium text-ink">Add to Home Screen</span>, then Add.</li>
        </ol>
        <p className="mt-2 text-sm text-muted">
          On a Mac, use Safari&apos;s File menu → Add to Dock.
        </p>
      </Card>

      <SignOutButton />
    </div>
  );
}
