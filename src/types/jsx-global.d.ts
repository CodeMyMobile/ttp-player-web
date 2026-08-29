// React 19's types removed the global `JSX` namespace in favour of `React.JSX`.
// Several pages still annotate with `JSX.Element`. Aliasing it back is additive and
// avoids editing files unrelated to the change that introduced type checking.
import type { JSX as ReactJSX } from "react";

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}
