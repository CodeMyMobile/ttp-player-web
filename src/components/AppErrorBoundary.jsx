import { Component } from "react";
import { ANALYTICS_EVENTS, track } from "../utils/analytics";
import { crashDetails, crashEventProps } from "./appCrash";

// Home is where most players land, so a crash there needs a reload, not a link to itself.
const goHome = () => {
  if (window.location.hash === "#/" || window.location.hash === "") {
    window.location.reload();
  } else {
    window.location.hash = "#/";
  }
};

// When anything below throws while rendering, React unmounts the whole app and the player
// sees a blank page. This catches it and shows what happened, with a way out, and records
// the crash (no player data, see appCrash.js) so it can be found without a screenshot.
//
// It sits outside the router, so it resets itself when the address changes: a crash on one
// page doesn't stop the player going to another.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: "", hash: "", copied: false };
    this.handleHashChange = this.handleHashChange.bind(this);
    this.copyDetails = this.copyDetails.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack || "";
    const hash = window.location.hash;
    this.setState({ componentStack, hash });
    console.error("The app crashed", error, componentStack);
    track(ANALYTICS_EVENTS.appCrashed, crashEventProps({ error, componentStack, hash }));
  }

  componentDidMount() {
    window.addEventListener("hashchange", this.handleHashChange);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  handleHashChange() {
    if (this.state.error && window.location.hash !== this.state.hash) {
      this.setState({ error: null, componentStack: "", hash: "", copied: false });
    }
  }

  details() {
    return crashDetails({
      error: this.state.error,
      componentStack: this.state.componentStack,
      hash: this.state.hash,
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    });
  }

  async copyDetails() {
    try {
      await navigator.clipboard.writeText(this.details());
      this.setState({ copied: true });
    } catch {
      // The details are on screen; a screenshot works too.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
          <h1 className="text-xl font-bold text-[#101828]">Something went wrong</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">
            This page hit an error. Reloading usually fixes it. If it keeps happening, send us a
            screenshot of this screen.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#8B5CF6] px-4 text-[15px] font-semibold text-white hover:bg-[#7C3AED]"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={goHome}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-[15px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Go to Home
            </button>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#475467]">Details for support</p>
              <button type="button" onClick={this.copyDetails} className="text-sm font-semibold text-[#7C3AED]">
                {this.state.copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#F2F4F7] p-3 text-xs leading-relaxed text-[#344054]">
              {this.details()}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
