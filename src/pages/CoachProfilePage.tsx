import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  MessageCircle,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { findCoachProfile, type CoachProfile } from "../data/mockCoachProfiles";

const highlightIconMap = {
  users: Users,
  trophy: Award,
  spark: Sparkles,
};

const metricIconMap = {
  dollar: DollarSign,
  users: Users,
  clock: Clock3,
  map: MapPin,
};

type BookingSelections = {
  lessonType: string;
  dateId?: string;
  timeId?: string;
};

const useCoachProfile = (id?: string) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | undefined>();

  useEffect(() => {
    let timer: number | undefined;
    setLoading(true);
    timer = window.setTimeout(() => {
      setProfile(id ? findCoachProfile(id) : undefined);
      setLoading(false);
    }, 520);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [id]);

  return { loading, profile };
};

const Chip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center rounded-full bg-coach-highlight px-3 py-1 text-[13px] font-semibold leading-[1.2] text-coach-body">
    {label}
  </span>
);

const BookButton = ({ disabled }: { disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coach-cta text-[15px] font-semibold text-white shadow-[0_18px_32px_rgba(22,163,74,0.2)] transition hover:bg-coach-ctaHover focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coach-focus disabled:cursor-not-allowed disabled:opacity-60"
  >
    Book session
    <CheckCircle2 className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
  </button>
);

const CoachProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, profile } = useCoachProfile(id);
  const [selection, setSelection] = useState<BookingSelections>(() => ({
    lessonType: "",
  }));

  useEffect(() => {
    if (!loading && profile) {
      setSelection({
        lessonType: profile.booking.defaultLessonType,
        dateId: profile.booking.availableDates[0]?.id,
        timeId: profile.booking.availableTimes[0]?.id,
      });
    }
  }, [loading, profile]);

  const lessonType = useMemo(() => {
    if (!profile) {
      return undefined;
    }
    return profile.booking.lessonTypes.find((item) => item.id === selection.lessonType) ??
      profile.booking.lessonTypes.find((item) => item.id === profile.booking.defaultLessonType);
  }, [profile, selection.lessonType]);

  const handleLessonTypeChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      lessonType: id,
    }));
  };

  const handleDateChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      dateId: id,
    }));
  };

  const handleTimeChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      timeId: prev.timeId === id ? undefined : id,
    }));
  };

  return (
    <MainLayout>
      <div className="w-full px-6 pb-20 pt-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[1128px] flex-col gap-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-coach-accent transition hover:text-coach-cta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus"
          >
            <ArrowLeft className="size-4" strokeWidth={2.5} /> Back to Coaches
          </button>

          {loading && (
            <div className="animate-pulse rounded-[28px] border border-coach-border bg-white p-10 shadow-coach-card">
              <div className="flex flex-col gap-10 lg:flex-row">
                <div className="flex-1 space-y-8">
                  <div className="flex gap-6">
                    <div className="h-24 w-24 rounded-3xl bg-coach-highlight" />
                    <div className="flex flex-1 flex-col gap-4">
                      <div className="h-6 w-48 rounded-full bg-coach-highlight" />
                      <div className="h-4 w-32 rounded-full bg-coach-highlight" />
                      <div className="flex gap-3">
                        <div className="h-10 w-28 rounded-2xl bg-coach-highlight" />
                        <div className="h-10 w-28 rounded-2xl bg-coach-highlight" />
                        <div className="h-10 w-28 rounded-2xl bg-coach-highlight" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 rounded-2xl bg-coach-highlight" />
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded-full bg-coach-highlight" />
                    <div className="h-4 w-3/4 rounded-full bg-coach-highlight" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-40 rounded-3xl bg-coach-highlight" />
                    ))}
                  </div>
                </div>
                <div className="w-full max-w-[340px] space-y-6">
                  <div className="h-[420px] rounded-3xl bg-coach-highlight" />
                </div>
              </div>
            </div>
          )}

          {!loading && !profile && (
            <div className="rounded-[28px] border border-dashed border-coach-border bg-white p-12 text-center shadow-coach-soft">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-coach-highlight text-coach-accent">
                <MessageCircle strokeWidth={2.4} />
              </div>
              <h2 className="mt-6 text-[26px] font-semibold tracking-[-0.01em] text-coach-heading">
                Coach not found
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-coach-body">
                We couldn’t locate that profile. It may have been removed or the link is incorrect. Return to the coach directory to keep exploring.
              </p>
              <Link
                to="/find-coaches"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-coach-border bg-coach-surface px-5 py-2.5 text-[15px] font-semibold text-coach-accent transition hover:border-coach-accent hover:text-coach-cta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus"
              >
                <ArrowLeft className="size-4" strokeWidth={2.5} /> Back to Find Coaches
              </Link>
            </div>
          )}

          {!loading && profile && (
            <div className="rounded-[28px] border border-coach-border bg-white p-10 shadow-coach-card">
              <div className="flex flex-col gap-10 lg:flex-row">
                <section className="flex-1 space-y-10">
                  <header className="flex flex-col gap-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                        <div className="flex items-start gap-5">
                          <img
                            src={profile.imageUrl}
                            alt={`Portrait of ${profile.name}`}
                            className="h-28 w-28 rounded-[28px] object-cover"
                          />
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.01em] text-coach-heading">
                                {profile.name}
                              </h1>
                              {profile.headlineBadge && (
                                <span className="inline-flex items-center rounded-full bg-coach-successSoft px-3 py-1 text-[13px] font-semibold text-coach-success">
                                  {profile.headlineBadge}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[15px] text-coach-body">
                              <span className="inline-flex items-center gap-2 font-semibold text-coach-heading">
                                <Star className="size-4" fill="#FDB022" stroke="#FDB022" strokeWidth={1.6} />
                                {profile.rating.toFixed(1)}
                              </span>
                              <span className="text-coach-subtle">({profile.reviewCount} reviews)</span>
                              <span className="hidden text-coach-subtle lg:inline">•</span>
                              <span className="text-coach-subtle">{profile.title}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-coach-subtle">
                              {profile.highlightChips.map((chip) => {
                                const Icon = highlightIconMap[chip.icon];
                                return (
                                  <span
                                    key={chip.label}
                                    className="inline-flex items-center gap-2 rounded-full border border-coach-highlightBorder bg-coach-surfaceSoft px-3 py-2 text-[13px] font-medium text-coach-body"
                                  >
                                    <Icon className="size-3.5" strokeWidth={2.2} />
                                    {chip.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {profile.metrics.map((metric) => {
                        const Icon = metricIconMap[metric.icon];
                        return (
                          <div
                            key={metric.label}
                            className="flex flex-col gap-2 rounded-3xl border border-coach-highlightBorder bg-coach-surfaceMuted p-5"
                          >
                            <div className="flex items-center gap-3 text-coach-subtle">
                              <span className="flex size-9 items-center justify-center rounded-2xl bg-white text-coach-accent shadow-sm">
                                <Icon className="size-4" strokeWidth={2.4} />
                              </span>
                              <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-coach-subtle">
                                {metric.label}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2 text-coach-heading">
                              <span className="text-[22px] font-semibold leading-none tracking-[-0.01em]">
                                {metric.value}
                              </span>
                              {metric.caption && (
                                <span className="text-[13px] font-medium uppercase text-coach-subtle">
                                  {metric.caption}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-coach-body">
                      <p>{profile.about}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {profile.certifications.map((certification) => (
                        <span
                          key={certification}
                          className="inline-flex items-center gap-2 rounded-full border border-coach-highlightBorder bg-white px-3 py-1.5 text-[13px] font-medium text-coach-body shadow-sm"
                        >
                          <CheckCircle2 className="size-3.5 text-coach-success" strokeWidth={2.4} />
                          {certification}
                        </span>
                      ))}
                    </div>
                  </header>

                  <section className="grid gap-6 xl:grid-cols-3">
                    <div className="rounded-3xl border border-coach-border bg-coach-surfaceMuted p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-coach-heading">Specialties</h2>
                        <Sparkles className="size-5 text-coach-accent" strokeWidth={2.4} />
                      </div>
                      <p className="mt-3 text-sm text-coach-subtle">
                        Focus areas Maria brings into every training block.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {profile.specialties.map((specialty) => (
                          <Chip key={specialty} label={specialty} />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-coach-border bg-coach-surfaceMuted p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-coach-heading">Coaching Locations</h2>
                        <MapPin className="size-5 text-coach-accent" strokeWidth={2.4} />
                      </div>
                      <p className="mt-3 text-sm text-coach-subtle">
                        Sessions can take place at these preferred clubs.
                      </p>
                      <ul className="mt-4 space-y-3 text-[15px] text-coach-body">
                        {profile.coachingLocations.map((location) => (
                          <li key={location} className="flex items-start gap-3">
                            <span className="mt-1 inline-flex size-2.5 rounded-full bg-coach-accent" />
                            <span>{location}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-3xl border border-coach-border bg-coach-surfaceMuted p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-coach-heading">Lesson Types</h2>
                        <Users className="size-5 text-coach-accent" strokeWidth={2.4} />
                      </div>
                      <p className="mt-3 text-sm text-coach-subtle">
                        Transparent pricing for the most requested sessions.
                      </p>
                      <ul className="mt-4 space-y-4">
                        {profile.lessonDetails.map((lesson) => (
                          <li key={lesson.title} className="rounded-2xl border border-coach-highlightBorder bg-white p-4 shadow-sm">
                            <div className="flex items-baseline justify-between gap-3">
                              <div>
                                <p className="text-[16px] font-semibold text-coach-heading">{lesson.title}</p>
                                <p className="mt-1 text-sm text-coach-subtle">{lesson.description}</p>
                              </div>
                              <div className="text-right text-coach-heading">
                                <p className="text-[18px] font-semibold">{lesson.price}</p>
                                <p className="text-[12px] font-medium uppercase text-coach-subtle">{lesson.cadence}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </section>

                <aside className="w-full max-w-[360px] space-y-6 self-start rounded-[26px] border border-coach-border bg-coach-surfaceMuted p-6 shadow-coach-soft">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-coach-heading">
                        {profile.booking.headline}
                      </h2>
                      <CalendarDays className="size-6 text-coach-accent" strokeWidth={2.4} />
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-coach-subtle">
                        Select lesson type
                      </span>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {profile.booking.lessonTypes.map((lesson) => {
                          const active = selection.lessonType
                            ? selection.lessonType === lesson.id
                            : lesson.id === profile.booking.defaultLessonType;
                          return (
                            <button
                              key={lesson.id}
                              type="button"
                              onClick={() => handleLessonTypeChange(lesson.id)}
                              className={`group flex flex-col gap-1 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus ${
                                active
                                  ? "border-coach-accent bg-coach-calendarAccent shadow-[0_10px_20px_rgba(37,99,235,0.15)]"
                                  : "border-coach-border bg-white hover:border-coach-accent/70"
                              }`}
                            >
                              <span className="text-[15px] font-semibold text-coach-heading">{lesson.label}</span>
                              <span className="text-sm text-coach-subtle">{lesson.description}</span>
                              <span className="text-[18px] font-semibold text-coach-accent">{lesson.price}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-coach-subtle">
                          Select date
                        </span>
                        <div className="text-sm font-medium text-coach-subtle">{profile.booking.monthLabel}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {profile.booking.availableDates.map((date) => {
                          const active = selection.dateId === date.id;
                          return (
                            <button
                              key={date.id}
                              type="button"
                              onClick={() => handleDateChange(date.id)}
                              className={`flex flex-col gap-2 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus ${
                                active
                                  ? "border-coach-accent bg-white shadow-[0_12px_24px_rgba(21,112,239,0.18)]"
                                  : "border-coach-border bg-white hover:border-coach-accent/60"
                              }`}
                            >
                              <div className="flex items-baseline justify-between text-coach-heading">
                                <span className="text-[20px] font-semibold">{date.date}</span>
                                <span className="text-xs font-medium uppercase text-coach-subtle">{date.day}</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {date.sessions.map((session) => (
                                  <span
                                    key={session}
                                    className="inline-flex items-center rounded-full bg-coach-highlight px-2 py-1 text-[11px] font-semibold uppercase text-coach-subtle"
                                  >
                                    {session}
                                  </span>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-coach-subtle">
                        Select time
                      </span>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {profile.booking.availableTimes.map((time) => {
                          const active = selection.timeId === time.id;
                          return (
                            <button
                              key={time.id}
                              type="button"
                              onClick={() => handleTimeChange(time.id)}
                              className={`rounded-2xl border px-4 py-2 text-[15px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus ${
                                active
                                  ? "border-coach-cta bg-coach-successSoft text-coach-cta"
                                  : "border-coach-border bg-white text-coach-heading hover:border-coach-cta/70"
                              }`}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {lessonType && (
                      <div className="rounded-2xl border border-coach-border bg-white px-4 py-3 text-sm text-coach-body">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-coach-heading">{lessonType.label}</span>
                          <span className="text-[17px] font-semibold text-coach-heading">{lessonType.price}</span>
                        </div>
                        <p className="mt-1 text-xs text-coach-subtle">{lessonType.description}</p>
                      </div>
                    )}
                    <BookButton disabled={!selection.dateId || !selection.timeId} />
                    <p className="text-center text-[13px] text-coach-subtle">
                      {profile.booking.note}
                    </p>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-coach-border bg-white px-4 py-3 text-[15px] font-semibold text-coach-heading transition hover:border-coach-accent hover:text-coach-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach-focus"
                    >
                      <MessageCircle className="size-4" strokeWidth={2.4} />
                      Message coach
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CoachProfilePage;
