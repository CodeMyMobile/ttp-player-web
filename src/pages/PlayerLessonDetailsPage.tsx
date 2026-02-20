import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";

import MainLayout from "../components/MainLayout";
import LessonDetailCard from "../components/LessonDetailCard";
import { fetchPlayerLessonById, type Lesson } from "../api/playerLessons";
import { getStoredAuthToken } from "../services/authToken";

import "./PlayerLessonDetailsPage.css";

const normalizeLesson = (payload: Lesson | { lesson?: Lesson } | null | undefined): Lesson | null => {
  if (!payload) return null;
  if ("lesson" in payload && payload.lesson) return payload.lesson;
  return payload as Lesson;
};

const PlayerLessonDetailsPage = () => {
  const { id } = useParams<{ id?: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing lesson id.");
      return;
    }

    const token = getStoredAuthToken({ preferScheme: "token" });
    if (!token) {
      setLoading(false);
      setError("Missing authentication token.");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void fetchPlayerLessonById({ token, lessonId: id, signal: controller.signal })
      .then((payload) => {
        if (cancelled) return;
        const normalized = normalizeLesson(payload);
        if (!normalized) {
          setLesson(null);
          setError("Lesson not found.");
          return;
        }
        setLesson(normalized);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load lesson details.";
        setLesson(null);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="player-lesson-details__empty" role="status">
          Loading lesson details…
        </div>
      );
    }

    if (error) {
      return (
        <div className="player-lesson-details__empty player-lesson-details__empty--error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <span>{error}</span>
        </div>
      );
    }

    if (!lesson) {
      return (
        <div className="player-lesson-details__empty" role="status">
          Lesson not found.
        </div>
      );
    }

    return <LessonDetailCard lesson={lesson} />;
  }, [error, lesson, loading]);

  return (
    <MainLayout>
      <div className="player-lesson-details">
        <Link to="/player/calendar" className="player-lesson-details__back">
          <ArrowLeft size={16} aria-hidden />
          Back to calendar
        </Link>
        {content}
      </div>
    </MainLayout>
  );
};

export default PlayerLessonDetailsPage;
