import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, Share2, Search, SlidersHorizontal } from "lucide-react";
import MainLayout from "../components/MainLayout";
import { trainingCollections } from "../data/trainingPlaylists";
import { resolveEmbedUrl, trainingVideoFilters, trainingVideos } from "../data/trainingVideos";

const STORAGE_KEY = "ttp-training-saved";

const TrainingLibraryPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRefinement, setActiveRefinement] = useState("all");
  const [savedVideos, setSavedVideos] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to read saved training sessions", error);
      return [];
    }
  });
  const [feedback, setFeedback] = useState(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const playlistOptions = useMemo(() => {
    const options = [
      { id: "all", label: "All content" },
      ...trainingCollections.map((collection) => ({
        id: collection.id,
        label: collection.title,
        focus: collection.focus,
      })),
    ];

    return options.filter(
      (option, index, array) => array.findIndex((candidate) => candidate.id === option.id) === index,
    );
  }, []);

  const activePlaylist = useMemo(() => {
    const candidate = searchParams.get("playlist");
    const validIds = new Set(playlistOptions.map((option) => option.id));
    return validIds.has(candidate) ? candidate : "all";
  }, [playlistOptions, searchParams]);

  const highlightedVideoId = useMemo(() => {
    const requestedIndex = searchParams.get("video");

    if (!requestedIndex) {
      return null;
    }

    const target = trainingVideos.find(
      (video) => video.playlistKey === activePlaylist && `${video.playlistIndex}` === requestedIndex,
    );

    return target ? target.id : null;
  }, [activePlaylist, searchParams]);

  const savedVideoSet = useMemo(() => new Set(savedVideos), [savedVideos]);

  const refinementPredicate = useMemo(() => {
    const filter = trainingVideoFilters.find((candidate) => candidate.id === activeRefinement);
    return filter?.predicate ?? null;
  }, [activeRefinement]);

  const visibleVideos = useMemo(() => {
    const playlistFiltered =
      activePlaylist === "all"
        ? trainingVideos
        : trainingVideos.filter((video) => video.playlistKey === activePlaylist);

    let refined = playlistFiltered;

    if (activeRefinement === "saved") {
      refined = refined.filter((video) => savedVideoSet.has(video.id));
    } else if (refinementPredicate) {
      refined = refined.filter((video) => refinementPredicate(video));
    }

    const query = searchTerm.trim().toLowerCase();

    const searched = query
      ? refined.filter(
          (video) =>
            video.title.toLowerCase().includes(query) ||
            video.description.toLowerCase().includes(query) ||
            video.focus.some((tag) => tag.toLowerCase().includes(query)),
        )
      : refined;

    return [...searched].sort((a, b) => a.playlistIndex - b.playlistIndex);
  }, [activePlaylist, activeRefinement, refinementPredicate, savedVideoSet, searchTerm]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedVideos));
  }, [savedVideos]);

  const focusVideoCard = useCallback((videoId) => {
    const element = document.getElementById(`training-video-${videoId}`);

    if (!element) {
      return;
    }

    element.classList.add("training-video-card--highlight");
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      element.classList.remove("training-video-card--highlight");
    }, 1800);
  }, []);

  useEffect(() => {
    if (!highlightedVideoId) {
      return;
    }

    focusVideoCard(highlightedVideoId);
  }, [focusVideoCard, highlightedVideoId]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const updateQuery = (playlistId, videoIndex) => {
    const params = new URLSearchParams(location.search);
    params.set("playlist", playlistId);

    if (typeof videoIndex === "number") {
      params.set("video", `${videoIndex}`);
    } else {
      params.delete("video");
    }

    navigate({ search: params.toString() }, { replace: false });
  };

  const handlePlaylistChange = (nextPlaylist) => {
    updateQuery(nextPlaylist, undefined);
  };

  const handleSaveToggle = (videoId) => {
    setSavedVideos((previous) => {
      const set = new Set(previous);

      if (set.has(videoId)) {
        set.delete(videoId);
        setFeedback({ type: "save", message: "Removed from saved training." });
      } else {
        set.add(videoId);
        setFeedback({ type: "save", message: "Added to your saved training." });
      }

      return Array.from(set);
    });
  };

  const handleShare = async (video) => {
    const params = new URLSearchParams({ playlist: video.playlistKey, video: `${video.playlistIndex}` });
    const shareUrl = `${window.location.origin}/#/training-library?${params.toString()}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, text: "Check out this training session", url: shareUrl });
        setFeedback({ type: "share", message: "Share sheet opened." });
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback({ type: "share", message: "Link copied to clipboard." });
        return;
      }

      setFeedback({ type: "share", message: `Link ready to copy: ${shareUrl}` });
    } catch (error) {
      console.error("Unable to share training video", error);
      setFeedback({ type: "share", message: `Link ready to copy: ${shareUrl}` });
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  return (
    <MainLayout>
      <section className="training-library">
        <header className="training-library__header">
          <div>
            <p className="overline">Training resources</p>
            <h1>Training Library</h1>
            <p className="training-library__subtitle">
              Stream every playlist from Tennis Training Pros without leaving your dashboard. Save drills for later and
              share links with your hitting partners.
            </p>
          </div>
        </header>

        <div className="training-library__controls">
          <div className="training-library__control-group">
            <span className="training-library__control-label">Playlists</span>
            <div className="training-library__chip-row">
              {playlistOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`training-library__chip${activePlaylist === option.id ? " is-active" : ""}`}
                  onClick={() => handlePlaylistChange(option.id)}
                >
                  <span className="training-library__chip-title">{option.label}</span>
                  {option.focus && option.id !== "all" && (
                    <span className="training-library__chip-focus">{option.focus}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="training-library__control-group">
            <span className="training-library__control-label">
              <SlidersHorizontal size={16} /> Refine
            </span>
            <div className="training-library__chip-row">
              {trainingVideoFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`training-library__chip${activeRefinement === filter.id ? " is-active" : ""}`}
                  onClick={() => setActiveRefinement(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <label className="training-library__search" htmlFor="training-search">
            <Search size={16} />
            <input
              id="training-search"
              type="search"
              placeholder="Search drills, skills, or focus areas"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </label>
        </div>

        {feedback && <div className="training-library__feedback">{feedback.message}</div>}

        <div className="training-library__grid">
          {visibleVideos.length === 0 && (
            <div className="training-library__empty">
              <p>No sessions match your filters yet. Adjust the filters or search to see more drills.</p>
            </div>
          )}

          {visibleVideos.map((video) => {
            const embedUrl = resolveEmbedUrl(video);
            const isSaved = savedVideoSet.has(video.id);

            return (
              <article
                key={video.id}
                id={`training-video-${video.id}`}
                className={`training-video-card${isSaved ? " is-saved" : ""}`}
              >
                <div className="training-video-card__player">
                  {embedUrl ? (
                    <iframe
                      title={`${video.title} video player`}
                      src={embedUrl}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="training-video-card__placeholder">Video unavailable</div>
                  )}
                </div>
                <div className="training-video-card__body">
                  <div className="training-video-card__meta">
                    <span className="training-video-card__duration">{video.duration}</span>
                    <span className="training-video-card__level">{video.skillLevel}</span>
                  </div>
                  <h2>{video.title}</h2>
                  <p>{video.description}</p>
                  <div className="training-video-card__tags">
                    {video.focus.map((tag) => (
                      <span key={tag} className="training-video-card__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="training-video-card__actions">
                  <button
                    type="button"
                    className="training-video-card__action primary"
                    onClick={() => handleSaveToggle(video.id)}
                  >
                    {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    {isSaved ? "Saved" : "Save to profile"}
                  </button>
                  <button
                    type="button"
                    className="training-video-card__action"
                    onClick={() => handleShare(video)}
                  >
                    <Share2 size={16} /> Share link
                  </button>
                  <button
                    type="button"
                    className="training-video-card__action"
                    onClick={() => {
                      updateQuery(video.playlistKey, video.playlistIndex);
                      focusVideoCard(video.id);
                    }}
                  >
                    Link in library
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </MainLayout>
  );
};

export default TrainingLibraryPage;
