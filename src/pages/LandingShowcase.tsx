import { Link } from "react-router-dom";

import "./LandingShowcase.css";

// "See it in action" — presentational recreations of the app's screens (fictional names,
// representative states). Everything is scoped under .landing-showcase / .appshot so the
// app-mimic styles can't leak into the rest of the site. No real member data.

const StatusBar = () => (
  <>
    <div className="island" />
    <div className="sbar">
      <span>7:45</span>
      <span className="r">
        5G <span className="batt" />
      </span>
    </div>
  </>
);

const AppBar = () => (
  <div className="appbar">
    <span className="logo">🎾</span>
    <span className="brand">
      The Tennis <span>Plan</span>
    </span>
    <span className="locpill">📍 Mar Vista, LA ▾</span>
    <span className="ava" />
  </div>
);

const CoachPhone = () => (
  <div className="appshot">
    <div className="phone">
      <div className="scr">
        <StatusBar />
        <AppBar />
        <div className="body">
          <div className="trust">
            <span className="ic">🛡️</span>
            <b>Coaches you can trust</b>
            <span className="invite">Invite-only</span>
          </div>
          <div className="ah1">Find a Coach</div>
          <div className="sub">Coaches in your area</div>
          <div className="search">🔍 Search by name, specialty, court…</div>
          <div className="within">
            📍 Within&nbsp;<b>10 mi</b>&nbsp;⇅
          </div>
          <div className="card">
            <div className="crow">
              <span className="init">ED</span>
              <div className="grow">
                <div className="nmrow">
                  <span className="nm">Elena Duarte</span>
                  <span className="ok">✔</span>
                </div>
                <div className="meta">📍 nearby</div>
              </div>
              <div className="price">
                <b>$140</b>
                <span>/hour</span>
              </div>
            </div>
            <div className="meta" style={{ padding: "0 14px 6px" }}>
              👥 students coached
            </div>
            <div className="bio">Tennis professional with 20+ years of playing and teaching experience…</div>
            <div className="opening">🟢 Next opening · Jul 10 · Mar Vista Recreation Center</div>
            <div className="acts">
              <span className="abtn o">View profile</span>
              <span className="abtn p">Book a lesson</span>
            </div>
          </div>
        </div>
        <div className="tabbar">
          <span className="tab">
            <span className="i">🏠</span>Home
          </span>
          <span className="tab on">
            <span className="i">👥</span>Coaches
          </span>
          <span className="tab">
            <span className="i">🏆</span>Play
          </span>
          <span className="tab">
            <span className="i">👤</span>You
          </span>
        </div>
      </div>
    </div>
  </div>
);

const PlayersPhone = () => (
  <div className="appshot">
    <div className="phone">
      <div className="scr">
        <StatusBar />
        <AppBar />
        <div className="body">
          <div className="ah1" style={{ fontSize: "19px", marginBottom: "10px" }}>
            Players near you
          </div>
          <div className="card">
            <div className="crow">
              <span className="init rd">CL</span>
              <div className="grow">
                <div className="nm">Camille Laurent</div>
                <div style={{ display: "flex", gap: "7px", marginTop: "5px", alignItems: "center" }}>
                  <span className="ntrp">NTRP 4.5</span>
                  <span className="verif">✔ Verified rating</span>
                </div>
              </div>
            </div>
            <div className="bio">Intermediate player who enjoys friendly, competitive hitting sessions…</div>
            <div className="chips">
              <span className="chip">Weekdays AM</span>
              <span className="chip">Weekday PM</span>
              <span className="chip">Weekends</span>
            </div>
            <div className="loc">📍 Cheviot Hills Recreation Center</div>
            <div className="loc" style={{ paddingBottom: "10px" }}>
              📍 Mar Vista Recreation Center
            </div>
            <div className="acts">
              <span className="abtn p">Connect</span>
              <span className="abtn o">View profile</span>
            </div>
          </div>
          <div className="card">
            <div className="crow">
              <span className="init rd">AW</span>
              <div className="grow">
                <div className="nm">Adam Whitfield</div>
                <div style={{ marginTop: "5px" }}>
                  <span className="ntrp">NTRP 4.0</span>
                </div>
              </div>
            </div>
            <div className="chips">
              <span className="chip">Weekdays AM</span>
              <span className="chip">Weekday PM</span>
            </div>
            <div className="loc" style={{ paddingBottom: "10px" }}>
              📍 Mar Vista Recreation Center
            </div>
          </div>
        </div>
        <div className="tabbar">
          <span className="tab">
            <span className="i">🏠</span>Home
          </span>
          <span className="tab on">
            <span className="i">👥</span>Players
          </span>
          <span className="tab">
            <span className="i">🏆</span>Play
          </span>
          <span className="tab">
            <span className="i">👤</span>You
          </span>
        </div>
      </div>
    </div>
  </div>
);

const LeaguePhone = () => (
  <div className="appshot">
    <div className="phone">
      <div className="scr">
        <StatusBar />
        <div className="lgbar">
          <div className="lgtop">
            <span className="bk">‹</span>
            <h2>Summer Flex League 4.5 ▾</h2>
            <span className="ava" />
          </div>
          <div className="lgtabs">
            <span className="on">Overview</span>
            <span>Standings</span>
            <span>Players</span>
            <span>Results</span>
          </div>
        </div>
        <div className="body" style={{ paddingTop: 0 }}>
          <div className="stand">
            <div className="cap">📈 Standings</div>
            <div className="note">You'll appear here after your first match.</div>
            <div className="st">
              <span className="rk">1</span>
              <span className="ci">SL</span>
              <span className="nn">Sam Lee 🔥5</span>
              <span className="wl" style={{ color: "#1B9E5A" }}>
                5–0
              </span>
            </div>
            <div className="st">
              <span className="rk">2</span>
              <span className="ci">JB</span>
              <span className="nn">Jesse Brennan</span>
              <span className="wl" style={{ color: "#1B9E5A" }}>
                3–1
              </span>
            </div>
            <div className="st">
              <span className="rk">3</span>
              <span className="ci">AP</span>
              <span className="nn">Alex Prior</span>
              <span className="wl" style={{ color: "#E24B4A" }}>
                2–3
              </span>
            </div>
            <div className="st you">
              <span className="rk">12</span>
              <span className="ci">YO</span>
              <span className="nn">You</span>
              <span className="youp">you</span>
              <span className="wl" style={{ color: "#171326" }}>
                0–0
              </span>
            </div>
            <div className="seeall">See full standings →</div>
          </div>
          <div className="card latest">
            <span className="tag">● LATEST</span>
            <span style={{ fontSize: "12px", color: "#9A9AA8" }}>now</span>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>🎾 Sam d. Kai 6-2 2-6 1-0</span>
          </div>
        </div>
        <div className="actbar">
          <span className="abtn p">Log a Score</span>
          <span className="abtn o" style={{ color: "#7A5AF0", borderColor: "#DCD5F8" }}>
            Need a Match
          </span>
        </div>
      </div>
    </div>
  </div>
);

const LandingShowcase = () => {
  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="landing-showcase">
          <div className="sc-head">
            <span className="sc-head__eyebrow">See it in action</span>
            <h2>The actual app</h2>
            <p>The screens you&apos;ll use every week — coaching, players, and your league.</p>
          </div>

          <div className="sc-row">
            <div className="sc-media">
              <CoachPhone />
            </div>
            <div className="sc-copy">
              <span className="sc-copy__eyebrow">Coaching</span>
              <h3>Browse coaches before you sign up</h3>
              <p>Real coaches and rates — the directory&apos;s public, no account needed.</p>
              <Link className="sc-lk" to="/find-coaches">
                Browse coaches →
              </Link>
            </div>
          </div>

          <div className="sc-row">
            <div className="sc-copy">
              <span className="sc-copy__eyebrow">Players</span>
              <h3>See who&apos;s free to play</h3>
              <p>Players at your level post when they&apos;re free — connect and get on court.</p>
              <Link className="sc-lk" to="/find-players">
                Find a partner →
              </Link>
            </div>
            <div className="sc-media">
              <PlayersPhone />
            </div>
          </div>

          <div className="sc-row">
            <div className="sc-media">
              <LeaguePhone />
            </div>
            <div className="sc-copy">
              <span className="sc-copy__eyebrow">Leagues</span>
              <h3>Track matches and climb</h3>
              <p>Live standings, results, and your ladder position — all in one place.</p>
              <Link className="sc-lk" to="/matches">
                See the ladder →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingShowcase;
