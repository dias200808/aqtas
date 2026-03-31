"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircleMore, Phone, Plus, Search, SendHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, timeAgo } from "@/lib/utils";

async function fetcher<T>(url: string) {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result.data as T;
}

type ThreadListItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CLASS";
  displayTitle: string;
  unreadCount: number;
  participants: Array<{
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      avatarUrl: string | null;
      role: string;
    };
  }>;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
};

type ContactItem = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  relationLabel?: string;
  classes: string[];
  subjects: string[];
  children: string[];
  canCreateDirect: boolean;
  canCreateGroup: boolean;
};

type ThreadMessage = {
  id: string;
  content: string;
  attachmentUrl?: string | null;
  createdAt: string;
  senderId: string;
  isEdited: boolean;
  sender: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

type ThreadDetail = {
  id: string;
  type: "DIRECT" | "GROUP" | "CLASS";
  displayTitle: string;
  participants: Array<{
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      avatarUrl: string | null;
      role: string;
    };
    classes: string[];
    subjects: string[];
    children: string[];
  }>;
  messages: ThreadMessage[];
};

function roleVariant(role: string) {
  switch (role) {
    case "TEACHER":
      return "info" as const;
    case "PARENT":
      return "warning" as const;
    case "ADMIN":
      return "danger" as const;
    case "STUDENT":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

function threadTypeLabel(type: ThreadListItem["type"] | ThreadDetail["type"]) {
  switch (type) {
    case "DIRECT":
      return "Direct";
    case "GROUP":
      return "Group";
    case "CLASS":
      return "Class group";
    default:
      return "Chat";
  }
}

export function MessagesWorkspace() {
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: () => fetcher<ThreadListItem[]>("/api/threads"),
  });

  const contactsQuery = useQuery({
    queryKey: ["thread-contacts"],
    queryFn: () => fetcher<ContactItem[]>("/api/threads/contacts"),
  });

  const filteredThreads =
    threadsQuery.data?.filter((thread) => {
      const text = `${thread.displayTitle} ${thread.lastMessage?.content ?? ""} ${thread.participants
        .map((participant) => `${participant.user.firstName} ${participant.user.lastName}`)
        .join(" ")}`.toLowerCase();
      return text.includes(threadSearch.toLowerCase());
    }) ?? [];

  const selectedThreadId = activeThreadId ?? filteredThreads[0]?.id ?? threadsQuery.data?.[0]?.id ?? null;

  const messagesQuery = useQuery({
    queryKey: ["thread", selectedThreadId],
    queryFn: () => fetcher<ThreadDetail>(`/api/threads/${selectedThreadId}/messages`),
    enabled: Boolean(selectedThreadId),
  });

  const allContacts = contactsQuery.data ?? [];

  const filteredContacts =
    contactsQuery.data?.filter((contact) => {
      const text = `${contact.fullName} ${contact.email} ${contact.phone ?? ""} ${contact.roleLabel} ${contact.relationLabel ?? ""} ${contact.subjects.join(" ")} ${contact.classes.join(" ")}`.toLowerCase();
      return text.includes(contactSearch.toLowerCase());
    }) ?? [];

  const selectedContacts = allContacts.filter((contact) => selectedContactIds.includes(contact.id));
  const selectionAllowsGroup = selectedContacts.some((contact) => contact.canCreateGroup);

  const focusCards = selectedContacts.length
    ? selectedContacts
    : (messagesQuery.data?.participants.map((participant) => ({
        id: participant.user.id,
        fullName: `${participant.user.firstName} ${participant.user.lastName}`,
        firstName: participant.user.firstName,
        lastName: participant.user.lastName,
        email: participant.user.email,
        phone: participant.user.phone,
        avatarUrl: participant.user.avatarUrl,
        role: participant.user.role,
        roleLabel: participant.user.role,
        relationLabel: undefined,
        classes: participant.classes,
        subjects: participant.subjects,
        children: participant.children,
        canCreateDirect: true,
        canCreateGroup: false,
      })) ?? []);

  const createThreadMutation = useMutation({
    mutationFn: async (payload: { type: "DIRECT" | "GROUP" | "CLASS"; title?: string; participantIds: string[] }) => {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create chat");
      return result.data as { id: string };
    },
    onSuccess: (data) => {
      setGroupTitle("");
      setSelectedContactIds([]);
      setActiveThreadId(data.id);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({ queryKey: ["thread-contacts"] });
      toast.success("Chat is ready");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThreadId,
          content: message,
          attachmentUrl: attachmentUrl || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send message");
      return result.data;
    },
    onSuccess: () => {
      setMessage("");
      setAttachmentUrl("");
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({ queryKey: ["thread", selectedThreadId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId],
    );
  };

  const startDirectChat = () => {
    if (selectedContacts.length !== 1) {
      toast.error("Select exactly one person for a direct chat");
      return;
    }

    createThreadMutation.mutate({
      type: "DIRECT",
      participantIds: [selectedContacts[0].id],
    });
  };

  const startGroupChat = (type: "GROUP" | "CLASS") => {
    if (selectedContacts.length < 2) {
      toast.error("Select at least two people for a group chat");
      return;
    }

    createThreadMutation.mutate({
      type,
      title: groupTitle || undefined,
      participantIds: selectedContacts.map((contact) => contact.id),
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/70">
          <div className="space-y-1">
            <CardTitle>Threads</CardTitle>
            <CardDescription>Safe school communication with unread badges and quick search.</CardDescription>
          </div>
          <Badge variant="neutral">{filteredThreads.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={threadSearch}
              onChange={(event) => setThreadSearch(event.target.value)}
              className="pl-10"
              placeholder="Search chats, teachers, or parents"
            />
          </div>

          <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {threadsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100/80" />
              ))
            ) : filteredThreads.length ? (
              filteredThreads.map((thread) => {
                const active = thread.id === selectedThreadId;
                const preview = thread.lastMessage?.content || "No messages yet";
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    className={cn(
                      "w-full rounded-3xl border p-4 text-left transition",
                      active
                        ? "border-blue-300 bg-blue-50/80 shadow-sm"
                        : "border-slate-200/80 bg-white/85 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{thread.displayTitle}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{threadTypeLabel(thread.type)}</p>
                      </div>
                      {thread.unreadCount ? <Badge variant="info">{thread.unreadCount}</Badge> : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{preview}</p>
                    {thread.lastMessage ? (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        {thread.lastMessage.senderName} · {timeAgo(thread.lastMessage.createdAt)}
                      </p>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-[var(--muted)]">
                No threads yet. Start a direct chat from the contact directory.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200/70">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <CardTitle>{messagesQuery.data?.displayTitle ?? "Conversation"}</CardTitle>
              {messagesQuery.data ? <Badge variant="neutral">{threadTypeLabel(messagesQuery.data.type)}</Badge> : null}
            </div>
            <CardDescription>
              {messagesQuery.data?.participants.length
                ? `${messagesQuery.data.participants.length} participant${messagesQuery.data.participants.length > 1 ? "s" : ""}`
                : "Open a thread to read and reply."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-[780px] flex-col pt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {messagesQuery.data?.participants.map((participant) => (
              <Badge key={participant.userId} variant={roleVariant(participant.user.role)}>
                {participant.user.firstName} {participant.user.lastName}
              </Badge>
            ))}
          </div>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto pr-2">
            {messagesQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-100/80" />
              ))
            ) : messagesQuery.data?.messages.length ? (
              messagesQuery.data.messages.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        firstName={item.sender.firstName}
                        lastName={item.sender.lastName}
                        className="h-11 w-11 rounded-2xl"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.sender.firstName} {item.sender.lastName}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{item.sender.role}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{timeAgo(item.createdAt)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>
                  {item.attachmentUrl ? (
                    <a
                      href={item.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
                    >
                      Open attachment
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 text-sm text-[var(--muted)]">
                Select a chat and start the conversation.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200/70 pt-4">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message to the teacher, parent, or group..."
              className="min-h-[120px]"
            />
            <Input
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              placeholder="Attachment link (optional)"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">You can share links to files, meeting docs, or homework resources.</p>
              <Button
                type="button"
                disabled={!selectedThreadId || !message.trim() || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                <SendHorizontal className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200/70">
            <div className="space-y-1">
              <CardTitle>New chat</CardTitle>
              <CardDescription>Find teachers, parents, and school contacts with phone and email.</CardDescription>
            </div>
            <Badge variant="neutral">{selectedContactIds.length} selected</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                className="pl-10"
                placeholder="Search by name, class, subject, email"
              />
            </div>

            <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
              {contactsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100/80" />
                ))
              ) : filteredContacts.length ? (
                filteredContacts.map((contact) => {
                  const checked = selectedContactIds.includes(contact.id);
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleContact(contact.id)}
                      className={cn(
                        "w-full rounded-3xl border p-4 text-left transition",
                        checked
                          ? "border-blue-300 bg-blue-50/80 shadow-sm"
                          : "border-slate-200/80 bg-white/85 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          firstName={contact.firstName}
                          lastName={contact.lastName}
                          src={contact.avatarUrl}
                          className="h-12 w-12 rounded-2xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{contact.fullName}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">{contact.roleLabel}</p>
                            </div>
                            {checked ? <Badge variant="info">Selected</Badge> : null}
                          </div>
                          {contact.relationLabel ? (
                            <p className="mt-2 text-xs font-medium text-blue-700">{contact.relationLabel}</p>
                          ) : null}
                          <div className="mt-3 space-y-1 text-xs text-slate-600">
                            <p className="truncate">{contact.email}</p>
                            {contact.phone ? <p>{contact.phone}</p> : null}
                            {contact.subjects.length ? <p>Subjects: {contact.subjects.join(", ")}</p> : null}
                            {contact.classes.length ? <p>Classes: {contact.classes.join(", ")}</p> : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-[var(--muted)]">
                  No matching contacts found.
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4">
              {selectionAllowsGroup ? (
                <Input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  placeholder="Group title (optional)"
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={selectedContactIds.length !== 1 || createThreadMutation.isPending}
                  onClick={startDirectChat}
                >
                  <MessageCircleMore className="h-4 w-4" />
                  Direct chat
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectionAllowsGroup || selectedContactIds.length < 2 || createThreadMutation.isPending}
                  onClick={() => startGroupChat("GROUP")}
                >
                  <Users className="h-4 w-4" />
                  Group chat
                </Button>
              </div>
              {selectionAllowsGroup ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={selectedContactIds.length < 2 || createThreadMutation.isPending}
                  onClick={() => startGroupChat("CLASS")}
                >
                  <Plus className="h-4 w-4" />
                  Create class-style group
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200/70">
            <div className="space-y-1">
              <CardTitle>Contact details</CardTitle>
              <CardDescription>Phone, email, subjects, and family context for the active chat.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {focusCards.length ? (
              focusCards.map((contact) => (
                <div key={contact.id} className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Avatar
                      firstName={contact.firstName}
                      lastName={contact.lastName}
                      src={contact.avatarUrl}
                      className="h-12 w-12 rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{contact.fullName}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{contact.roleLabel}</p>
                        </div>
                        <Badge variant={roleVariant(contact.role)}>{contact.role}</Badge>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[var(--muted)]" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-[var(--muted)]" />
                            <span>{contact.phone}</span>
                          </div>
                        ) : null}
                      </div>

                      {contact.relationLabel ? (
                        <p className="mt-3 text-xs font-medium text-blue-700">{contact.relationLabel}</p>
                      ) : null}
                      {contact.subjects.length ? (
                        <p className="mt-3 text-xs text-slate-600">Subjects: {contact.subjects.join(", ")}</p>
                      ) : null}
                      {contact.classes.length ? (
                        <p className="mt-2 text-xs text-slate-600">Classes: {contact.classes.join(", ")}</p>
                      ) : null}
                      {contact.children.length ? (
                        <p className="mt-2 text-xs text-slate-600">Children: {contact.children.join(", ")}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-[var(--muted)]">
                Pick a contact or open a thread to see communication details.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
