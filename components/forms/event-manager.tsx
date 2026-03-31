"use client";

import { useState } from "react";
import { EventType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EventView = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  type: EventType;
  classId: string | null;
  schoolClass: { name: string } | null;
};

function EventEditor({
  event,
  classes,
}: {
  event: EventView;
  classes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: event.title,
    description: event.description,
    startAt: new Date(event.startAt).toISOString().slice(0, 16),
    endAt: new Date(event.endAt).toISOString().slice(0, 16),
    type: event.type,
    classId: event.classId ?? "",
  });

  async function save() {
    setLoading(true);
    const response = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        classId: form.classId || null,
      }),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Unable to update event");
      return;
    }

    toast.success("Event updated");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this event?")) return;

    setLoading(true);
    const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Unable to delete event");
      return;
    }

    toast.success("Event deleted");
    router.refresh();
  }

  return (
    <details className="rounded-2xl border bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        {event.title} | {event.schoolClass?.name || "Whole school"}
      </summary>
      <div className="mt-4 grid gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(eventValue) => setForm((current) => ({ ...current, title: eventValue.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(eventValue) => setForm((current) => ({ ...current, description: eventValue.target.value }))} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Start</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(eventValue) => setForm((current) => ({ ...current, startAt: eventValue.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(eventValue) => setForm((current) => ({ ...current, endAt: eventValue.target.value }))} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onChange={(eventValue) => setForm((current) => ({ ...current, type: eventValue.target.value as EventType }))}>
              {Object.values(EventType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={form.classId} onChange={(eventValue) => setForm((current) => ({ ...current, classId: eventValue.target.value }))}>
              <option value="">Whole school</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="button" disabled={loading} onClick={save}>
            {loading ? "Saving..." : "Save changes"}
          </Button>
          <Button type="button" variant="outline" disabled={loading} onClick={remove}>
            Delete
          </Button>
        </div>
      </div>
    </details>
  );
}

export function EventManager({
  classes,
  events,
}: {
  classes: Array<{ id: string; name: string }>;
  events: EventView[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    type: EventType;
    classId: string;
  }>(() => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      title: "",
      description: "",
      startAt: start.toISOString().slice(0, 16),
      endAt: end.toISOString().slice(0, 16),
      type: EventType.SCHOOL,
      classId: "",
    };
  });

  async function createEvent() {
    setLoading(true);
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        classId: form.classId || null,
      }),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Unable to create event");
      return;
    }

    toast.success("Event created");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage events</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Quarter math olympiad" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What students and parents need to know" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="datetime-local" value={form.endAt} onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EventType }))}>
                {Object.values(EventType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}>
                <option value="">Whole school</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="button" disabled={loading} onClick={createEvent}>
            {loading ? "Saving..." : "Add event"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length ? (
            events.map((event) => <EventEditor key={event.id} event={event} classes={classes} />)
          ) : (
            <p className="text-sm text-[var(--muted)]">No events created yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
