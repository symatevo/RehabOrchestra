import { Component } from "react";

export class RootErrorBoundary extends Component {
  state = { err: null };

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    if (import.meta.env.DEV) {
      console.error(err, info.componentStack);
    }
  }

  render() {
    if (this.state.err) {
      const msg =
        this.state.err instanceof Error
          ? this.state.err.message
          : String(this.state.err);
      return (
        <div
          style={{
            padding: 28,
            fontFamily: "system-ui, sans-serif",
            maxWidth: 640,
            margin: "48px auto",
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: 12 }}>
            Something went wrong
          </h1>
          <pre
            style={{
              background: "#f1f5f9",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
            }}
          >
            {msg}
          </pre>
          <p style={{ marginTop: 16, color: "#475569", fontSize: 14 }}>
            Reload the page. If it keeps happening, press F12 → Console and copy
            the red error text (or a screenshot) so we can match it to a fix.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
