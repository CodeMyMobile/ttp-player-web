import "./LegalFooter.css";

/**
 * Global footer for public / logged-out pages, linking to the statically
 * served legal pages. These live outside the HashRouter SPA, so we use plain
 * anchors (full-page navigation) rather than react-router <Link>.
 */
const LegalFooter = () => (
  <footer className="legal-footer-bar">
    <div className="legal-footer-bar__inner">
      <span className="legal-footer-bar__copy">&copy; The Tennis Plan</span>
      <nav className="legal-footer-bar__links" aria-label="Legal">
        <a className="legal-footer-bar__link" href="/privacy">
          Privacy Policy
        </a>
        <a className="legal-footer-bar__link" href="/terms">
          Terms of Service
        </a>
      </nav>
    </div>
  </footer>
);

export default LegalFooter;
