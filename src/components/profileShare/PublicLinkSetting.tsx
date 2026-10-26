import { useEffect, useState } from "react";

import { getMyPublicLink, setPublicLinkEnabled, type PublicProfileLink } from "../../api/publicProfile";
import { buildProfileUrl } from "../../utils/publicProfileLink";
import "./profileShare.css";

/**
 * "Allow public profile link". Off: /p/:slug says the profile is private and the
 * share options leave the profile menu.
 */
const PublicLinkSetting = () => {
  const [link, setLink] = useState<PublicProfileLink | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMyPublicLink()
      .then((result) => {
        if (!cancelled) setLink(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  const toggle = async () => {
    if (!link || saving) return;
    setSaving(true);
    setError("");
    try {
      setLink(await setPublicLinkEnabled(!link.enabled));
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-card">
      <div className="plink-setting">
        <div>
          <h2 className="settings-card__title" id="plink-setting-label">
            Allow public profile link
          </h2>
          <p className="settings-card__subtitle" id="plink-setting-help">
            {link?.enabled
              ? "Anyone with your link sees your name, level and home courts. Contact details stay private."
              : "Your link shows “This profile is private”, and sharing is turned off."}
          </p>
          {link?.enabled ? <p className="plink-setting__url">{buildProfileUrl(link.slug)}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(link?.enabled)}
          aria-labelledby="plink-setting-label"
          aria-describedby="plink-setting-help"
          className={`plink-switch${link?.enabled ? " plink-switch--on" : ""}`}
          onClick={toggle}
          disabled={!link || saving}
        >
          <span className="plink-switch__knob" aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p className="pprofile-setting-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PublicLinkSetting;
