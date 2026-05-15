import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import "./tailwind.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://ynga.kingcola-icg.cn" crossOrigin="anonymous" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var readySent = false;

                var params = new URLSearchParams(window.location.search);
                var theme = params.get("theme");
                if (theme !== "dark" && theme !== "light") {
                  theme = "light";
                }
                document.documentElement.classList.toggle("dark", theme === "dark");
                window.__YNGA_EMBED_THEME__ = theme;

                function postReady(phase) {
                  if (readySent) return;
                  readySent = true;
                  try {
                    window.parent?.postMessage(
                      {
                        type: "ynga-rag-embed-ready",
                        theme: window.__YNGA_EMBED_THEME__ || "light",
                        phase: phase,
                      },
                      "*"
                    );
                  } catch (error) {
                    console.error(error);
                  }
                }

                if (document.readyState !== "loading") {
                  postReady(document.readyState);
                } else {
                  document.addEventListener(
                    "DOMContentLoaded",
                    function() {
                      postReady("DOMContentLoaded");
                    },
                    { once: true }
                  );
                }

                window.addEventListener("load", function() {
                  postReady("load");
                });
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function applyTheme(theme) {
                  if (theme !== "dark" && theme !== "light") return;
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  window.__YNGA_EMBED_THEME__ = theme;
                }

                window.addEventListener("message", function(event) {
                  var data = event && event.data;
                  if (!data || data.type !== "ynga-theme-change") return;
                  applyTheme(data.theme);
                });

                window.addEventListener("load", function() {
                  try {
                    window.parent?.postMessage(
                      {
                        type: "ynga-rag-embed-ready",
                        theme: window.__YNGA_EMBED_THEME__ || "light"
                      },
                      "*"
                    );
                  } catch (error) {
                    console.error(error);
                  }
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
