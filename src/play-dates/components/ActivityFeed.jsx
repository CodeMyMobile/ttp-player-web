import React from "react";
import {
  AlertCircle,
  Bell,
  Loader2,
  Mail,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

const toneStyles = {
  success: {
    container: "border border-emerald-100 bg-white text-emerald-900",
    badge: "bg-emerald-50 text-emerald-700",
    icon: "text-emerald-500",
  },
  pending: {
    container: "border border-amber-100 bg-white text-amber-900",
    badge: "bg-amber-50 text-amber-700",
    icon: "text-amber-500",
  },
  warning: {
    container: "border border-yellow-100 bg-white text-amber-900",
    badge: "bg-yellow-50 text-amber-700",
    icon: "text-amber-500",
  },
  info: {
    container: "border border-indigo-100 bg-white text-indigo-900",
    badge: "bg-indigo-50 text-indigo-700",
    icon: "text-indigo-500",
  },
  danger: {
    container: "border border-rose-100 bg-white text-rose-900",
    badge: "bg-rose-50 text-rose-700",
    icon: "text-rose-500",
  },
  neutral: {
    container: "border border-slate-100 bg-white text-slate-900",
    badge: "bg-slate-50 text-slate-600",
    icon: "text-slate-500",
  },
};

const actionStyles = {
  primary:
    "inline-flex items-center justify-center rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-gray-700",
  success:
    "inline-flex items-center justify-center rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600",
  warning:
    "inline-flex items-center justify-center rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-600",
  danger:
    "inline-flex items-center justify-center rounded-md bg-red-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-red-600",
  outline:
    "inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50",
  ghost:
    "inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-100",
};

const ActivityFeed = ({
  items,
  loading = false,
  errors = [],
  onRefresh,
  onViewAll,
  pendingInviteCount = 0,
  unreadUpdateCount = 0,
}) => {
  const filteredErrors = errors.filter((message) => Boolean(message?.trim?.()));
  const showSkeleton = loading && (!items || items.length === 0);
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white/95 p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">Activity Feed</h3>
          {pendingInviteCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Mail className="h-3 w-3" />
              {pendingInviteCount} pending
            </span>
          )}
          {unreadUpdateCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              <Bell className="h-3 w-3" />
              {unreadUpdateCount} new
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              <span>{loading ? "Refreshing" : "Refresh"}</span>
            </button>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-gray-700"
            >
              View all
            </button>
          )}
        </div>
      </div>

      {filteredErrors.length > 0 && (
        <div className="space-y-2">
          {filteredErrors.map((message, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}

      {showSkeleton ? (
        <div className="overflow-x-auto">
          <div className="flex w-max max-w-full gap-2.5 pb-1">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="flex min-w-[220px] max-w-[240px] shrink-0 flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2"
              >
                <div className="h-3.5 w-20 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-2.5 w-3/4 rounded bg-gray-100 animate-pulse" />
                <div className="h-2 w-1/2 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : hasItems ? (
        <div className="overflow-x-auto">
          <div className="flex w-max max-w-full gap-2.5 pb-1">
            {items.map((item) => {
              const tone = toneStyles[item.tone] || toneStyles.neutral;
              const IconComponent = item.icon;
              return (
                <article
                  key={item.id}
                  className={`flex min-w-[230px] max-w-[260px] shrink-0 items-start gap-2 rounded-xl px-3 py-2 text-[13px] shadow-sm ${tone.container}`}
                >
                  {IconComponent && (
                    <IconComponent className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone.icon}`} />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone.badge}`}>
                        {item.statusLabel}
                      </span>
                      {item.relativeTime && (
                        <span className="text-[9px] font-medium text-gray-500" title={item.timestampLabel}>
                          {item.relativeTime}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[12px] font-semibold leading-snug text-gray-900">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-[11px] font-medium leading-snug text-gray-600">
                        {item.description}
                      </p>
                    )}
                    {item.meta?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {item.meta.map((meta, metaIndex) => {
                          const MetaIcon = meta.icon;
                          return (
                            <span
                              key={`${item.id}-meta-${metaIndex}`}
                              className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5 text-[9px] font-medium text-gray-600"
                            >
                              {MetaIcon && <MetaIcon className="h-3 w-3" />}
                              <span className="truncate max-w-[120px]">
                                {meta.label}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {item.actions?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {item.actions.map((action, actionIndex) => {
                          const variant =
                            action.variant && actionStyles[action.variant]
                              ? action.variant
                              : "outline";
                          const className = `${actionStyles[variant]} ${action.className || ""}`.trim();
                          return (
                            <button
                              key={`${item.id}-action-${actionIndex}`}
                              type="button"
                              onClick={action.onClick}
                              disabled={action.disabled}
                              className={`${className} ${
                                action.disabled
                                  ? "cursor-not-allowed opacity-60"
                                  : ""
                              }`}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center shadow-sm">
          <Sparkles className="h-8 w-8 text-emerald-400" />
          <h4 className="text-sm font-semibold text-gray-900">You're all caught up</h4>
          <p className="text-xs font-medium text-gray-500 max-w-sm">
            We'll let you know as soon as there are new invites, player responses, or matches that need more players.
          </p>
        </div>
      )}
    </section>
  );
};

export default ActivityFeed;
