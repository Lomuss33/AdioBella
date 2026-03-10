import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";
import "./styles/playing-cards.css";

const FAVICON_HREF = "/favicon.ico?v=root-belot-20260310";

syncFaviconLink("icon", FAVICON_HREF, "image/x-icon");
syncFaviconLink("shortcut icon", FAVICON_HREF);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);

function syncFaviconLink(rel: string, href: string, type?: string) {
  const selector = `link[rel="${rel}"]`;
  const existingLink = document.head.querySelector<HTMLLinkElement>(selector);
  const link = existingLink ?? document.createElement("link");

  link.rel = rel;
  link.href = href;
  if (type) {
    link.type = type;
  }

  if (!existingLink) {
    document.head.appendChild(link);
  }
}
