import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { PageHeader } from "@/components/shared/page-header";

export default function MessagesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Messages"
        description="Parents can reach teachers directly, view school contact details, and create safe group chats with role-based access."
      />
      <MessagesWorkspace />
    </div>
  );
}
