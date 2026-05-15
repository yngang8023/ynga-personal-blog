import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import "./tailwind.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="preload"
          href="/assets/LXGWWenKai-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var params = new URLSearchParams(window.location.search);
                var theme = params.get("theme");
                if (theme !== "dark" && theme !== "light") {
                  theme = "light";
                }
                document.documentElement.classList.toggle("dark", theme === "dark");
                window.__YNGA_EMBED_THEME__ = theme;
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
