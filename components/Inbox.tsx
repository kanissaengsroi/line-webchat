"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, MessageSquareText, RefreshCw } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ConfirmDelete } from "./ConfirmDelete";
import { ConversationMenu, type ConversationAction } from "./ConversationMenu";
import { ConversationList } from "./ConversationList";
import { LangToggle } from "./LangToggle";
import { useLang } from "./LangProvider";
import { Thread } from "./Thread";
import { useInbox, type Connection } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { signOut } from "@/lib/signOut";

const OA_URL = process.env.NEXT_PUBLIC_LINE_OA_URL;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function Inbox({ username }: { username: string }) {
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inbox = useInbox(selectedId);
  const now = useNow();
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [menu, setMenu] = useState<{ userId: string; position: { top: number; left: number } } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const menuConv = menu ? inbox.byId[menu.userId] : undefined;
  const deleteConv = confirmDelete ? inbox.byId[confirmDelete] : undefined;

  function runAction(userId: string, action: ConversationAction) {
    const c = inbox.byId[userId];
    if (!c) return;
    if (action === "pin") inbox.setFlags(userId, { pinned: !c.pinned });
    else if (action === "mute") inbox.setFlags(userId, { muted: !c.muted });
    else setConfirmDelete(userId);
  }

  // Someone else deleted the open conversation: close it.
  useEffect(() => {
    if (selectedId && inbox.listLoaded && !inbox.byId[selectedId]) setSelectedId(null);
  }, [selectedId, inbox.byId, inbox.listLoaded]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inbox.conversations;
    return inbox.conversations.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q),
    );
  }, [inbox.conversations, query]);

  const selected = selectedId ? inbox.byId[selectedId] : undefined;

  function select(id: string, focusComposer = true) {
    setSelectedId(id);
    // On desktop, land straight in the reply box.
    if (focusComposer && window.matchMedia("(min-width: 768px)").matches) {
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  // Keyboard: / search, j/k or arrows to move, Esc back to the list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || menu || confirmDelete) return;
      if (e.key === "Escape" && e.target === searchRef.current && query) {
        setQuery("");
        return;
      }
      if (isTyping(e.target) && e.target !== searchRef.current) return;
      const down = e.key === "ArrowDown" || (e.key === "j" && !isTyping(e.target));
      const up = e.key === "ArrowUp" || (e.key === "k" && !isTyping(e.target));
      if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (down || up) {
        if (visible.length === 0) return;
        e.preventDefault();
        const i = visible.findIndex((c) => c.userId === selectedId);
        const next = i === -1 ? 0 : Math.min(Math.max(i + (down ? 1 : -1), 0), visible.length - 1);
        select(visible[next].userId, false);
      } else if (e.key === "Enter" && e.target === searchRef.current && visible[0]) {
        e.preventDefault();
        select(selectedId && visible.some((c) => c.userId === selectedId) ? selectedId : visible[0].userId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const empty = inbox.listLoaded && !inbox.listError && inbox.conversations.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-rule bg-panel px-3 sm:px-4">
        <BrandMark className="size-5 text-go" />
        <span className="hidden font-semibold text-ink sm:inline">{t("appName")}</span>
        <ConnectionBadge connection={inbox.connection} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[13px] text-ink-3 sm:inline">
            {t("signedInAs")} <span className="font-medium text-ink-1">{username}</span>
          </span>
          <LangToggle />
          <button
            type="button"
            onClick={signOut}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-raised hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("logout")}</span>
            <span className="sr-only sm:hidden">{t("logout")}</span>
          </button>
        </div>
      </header>

      {inbox.connection === "reconnecting" && (
        <p role="status" className="border-b border-amber/30 bg-amber-dim px-4 py-2 text-[13px] text-amber">
          {t("offline")}
        </p>
      )}

      <div className="grid min-h-0 flex-1 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={`min-h-0 border-rule bg-panel md:block md:border-r ${selected ? "hidden" : "block"}`}
        >
          {!inbox.listLoaded ? (
            <ListSkeleton />
          ) : inbox.listError ? (
            <div className="p-4">
              <p className="text-red">{t("loadError")}</p>
              <button
                type="button"
                onClick={inbox.reload}
                className="mt-3 flex items-center gap-2 rounded-md border border-rule-strong px-3 py-1.5 text-ink-1 hover:bg-raised"
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("retry")}
              </button>
            </div>
          ) : empty ? (
            <EmptyInbox />
          ) : (
            <ConversationList
              ref={searchRef}
              conversations={visible}
              selectedId={selectedId}
              query={query}
              onQuery={setQuery}
              onSelect={(id) => select(id)}
              onMenu={(userId, position) => setMenu({ userId, position })}
              now={now}
            />
          )}
        </aside>

        <main className={`min-h-0 bg-ground ${selected ? "block" : "hidden md:block"}`}>
          {selected ? (
            <Thread
              conversation={selected}
              messages={inbox.messages[selected.userId]}
              now={now}
              composerRef={composerRef}
              onBack={() => setSelectedId(null)}
              onSend={(text) => inbox.send(selected.userId, text, username)}
              onRetry={(id) => inbox.retry(selected.userId, id)}
              onDiscard={(id) => inbox.discard(selected.userId, id)}
              onMenu={(position) => setMenu({ userId: selected.userId, position })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <MessageSquareText className="size-8 text-quiet" aria-hidden />
              <p className="mt-3 font-medium text-ink-1">{empty ? t("emptyStep3") : t("pickTitle")}</p>
              {!empty && <p className="mt-1 text-[13px] text-ink-3">{t("pickHint")}</p>}
            </div>
          )}
        </main>
      </div>

      {menu && menuConv && (
        <ConversationMenu
          conversation={menuConv}
          position={menu.position}
          onAction={(action) => runAction(menuConv.userId, action)}
          onClose={() => setMenu(null)}
        />
      )}
      {deleteConv && (
        <ConfirmDelete
          conversation={deleteConv}
          onConfirm={async () => {
            const ok = await inbox.remove(deleteConv.userId);
            if (ok && selectedId === deleteConv.userId) setSelectedId(null);
            return ok;
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export function ConnectionBadge({ connection }: { connection: Connection }) {
  const { t } = useLang();
  const label =
    connection === "live" ? t("live") : connection === "polling" ? t("polling") : t("reconnecting");
  const dot =
    connection === "live" ? "bg-go live-dot" : connection === "polling" ? "bg-ink-3" : "bg-amber";
  return (
    <span className="flex items-center gap-2 rounded-full border border-rule px-2.5 py-0.5 text-xs text-ink-2" role="status">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="px-4 pt-14" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <span className="size-9 animate-pulse rounded-full bg-raised" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-raised" />
            <span className="block h-2.5 w-3/4 animate-pulse rounded bg-raised" />
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyInbox() {
  const { t } = useLang();
  const steps = [t("emptyStep1"), t("emptyStep2"), t("emptyStep3")];
  return (
    <div className="px-5 py-6">
      <h2 className="font-semibold text-ink">{t("emptyTitle")}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-ink-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-rule-strong font-mono text-xs text-ink-1">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      {OA_URL && (
        <a
          href={OA_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-go px-3.5 font-semibold text-on-go hover:bg-go-hover"
        >
          {t("openOa")}
        </a>
      )}
    </div>
  );
}
