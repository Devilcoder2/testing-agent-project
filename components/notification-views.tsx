"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Feedback, PageHeader, StatusBadge } from "./ui";

type NotificationItem = {
  id: string;
  type: "RUN_FAILED" | "AUTO_RUN_CHECKPOINT" | "RELEASE_RUN_COMPLETED" | "CHANGE_PROPOSAL_REQUESTED" | "CHANGE_PROPOSAL_RESOLVED";
  deliveryStatus: "PENDING" | "SENT" | "FAILED";
  deliveryAttempts: number;
  deliveryError: string | null;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  productName: string | null;
  run: { id: string; name: string; outcome: string | null } | null;
  release: { id: string; name: string; readiness: string } | null;
  changeProposal: { id: string; status: string; testCaseName: string } | null;
};

async function request(path: string, method = "GET") {
  const response = await fetch(`/api/${path}`, { method });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

function label(notification: NotificationItem) {
  if (notification.type === "RUN_FAILED") return `Run failed · ${notification.run?.name ?? notification.productName ?? "Test Case"}`;
  if (notification.type === "AUTO_RUN_CHECKPOINT") return `Checkpoint review needed · ${notification.run?.name ?? notification.productName ?? "Test Case"}`;
  if (notification.type === "CHANGE_PROPOSAL_REQUESTED") return `Change review needed · ${notification.changeProposal?.testCaseName ?? "Test Case"}`;
  if (notification.type === "CHANGE_PROPOSAL_RESOLVED") return `Change proposal ${notification.changeProposal?.status.toLowerCase() ?? "updated"} · ${notification.changeProposal?.testCaseName ?? "Test Case"}`;
  return `Release completed · ${notification.release?.name ?? "Release"}`;
}

function deliveryTone(status: NotificationItem["deliveryStatus"]) {
  return status === "SENT" ? "success" as const : status === "FAILED" ? "danger" as const : "warning" as const;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function NotificationsView() {
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(nextFilter = filter) {
    setLoading(true);
    setMessage("");
    try {
      setNotifications(await request(`notifications?filter=${nextFilter}`) as NotificationItem[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]);

  async function markRead(notificationId: string) {
    try {
      await request(`notifications/${notificationId}/read`, "PATCH");
      setNotifications((items) => filter === "unread" ? items.filter((item) => item.id !== notificationId) : items.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
      setMessage("Notification marked as read.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark the notification as read.");
    }
  }

  async function markAllRead() {
    try {
      const result = await request("notifications/read-all", "POST") as { count: number };
      setNotifications((items) => filter === "unread" ? [] : items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setMessage(result.count ? `${result.count} notification${result.count === 1 ? "" : "s"} marked as read.` : "There are no unread notifications.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark notifications as read.");
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  return <div className="dashboard-grid">
    <PageHeader eyebrow="Safe operational updates" title="Notifications" detail="Only events you can currently access are shown. Email delivery contains no evidence or sensitive values." actions={<div className="notification-toolbar"><div className="notification-filter" aria-label="Notification filter"><Button type="button" variant={filter === "unread" ? "primary" : "secondary"} onClick={() => setFilter("unread")}>Unread</Button><Button type="button" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>All</Button></div><Button type="button" variant="secondary" disabled={unreadCount === 0} onClick={() => void markAllRead()}>Mark all read</Button></div>} />
    {message && <Feedback tone={message.includes("Could not") || message.includes("access") ? "danger" : "success"}>{message}</Feedback>}
    <Card className="panel-card notification-inbox"><div className="panel-card__head"><div><p className="eyebrow">{filter === "unread" ? "Unread only" : "All notifications"}</p><h2>{loading ? "Loading inbox" : `${notifications.length} visible notification${notifications.length === 1 ? "" : "s"}`}</h2></div><StatusBadge tone={unreadCount ? "warning" : "success"}>{unreadCount ? `${unreadCount} unread` : "All caught up"}</StatusBadge></div>{loading ? <StatusBadge tone="info">Loading notifications</StatusBadge> : notifications.length === 0 ? <EmptyState title={filter === "unread" ? "All caught up" : "No notifications yet"} detail={filter === "unread" ? "New failed Runs, checkpoint reviews, and change decisions will appear here." : "Run, Release, and change-review events will appear here when they happen."} /> : <div className="notification-list">{notifications.map((notification) => { const href = notification.run ? `/runs/${notification.run.id}` : notification.release ? `/releases/${notification.release.id}` : notification.changeProposal ? "/review" : null; return <article className={`notification-item ${notification.readAt ? "notification-item--read" : ""}`} key={notification.id}><div className="notification-item__main"><div className="notification-item__head"><h3>{label(notification)}</h3>{!notification.readAt && <StatusBadge tone="info">Unread</StatusBadge>}</div><p>{notification.productName ?? notification.release?.name ?? "Sentinel"} · {formatTimestamp(notification.createdAt)}</p><div className="notification-item__meta"><StatusBadge tone={deliveryTone(notification.deliveryStatus)}>{notification.deliveryStatus.toLowerCase()}</StatusBadge>{notification.deliveryError && <span>{notification.deliveryError}</span>}{notification.deliveryAttempts > 1 && <span>{notification.deliveryAttempts} delivery attempts</span>}</div></div><div className="notification-item__actions">{href && <Link className="button button--secondary" href={href}>Open <span aria-hidden="true">→</span></Link>}{!notification.readAt && <Button type="button" variant="ghost" onClick={() => void markRead(notification.id)}>Mark read</Button>}</div></article>; })}</div>}</Card>
  </div>;
}
