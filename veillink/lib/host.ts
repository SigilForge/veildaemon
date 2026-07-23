import { product } from "@/lib/config";

export type RouteMatch =
  | { type: "path"; slug: string }
  | { type: "subdomain"; slug: string }
  | { type: "none" };

function hostWithoutPort(host: string) {
  return host.toLowerCase().split(":")[0];
}

function configuredAppHost() {
  try {
    return new URL(product.appUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function parseRedirectRequest(hostHeader: string, pathname: string): RouteMatch {
  const host = hostWithoutPort(hostHeader);
  const baseDomain = product.baseDomain.toLowerCase();
  const pathHost = product.pathHost.toLowerCase();
  const appHost = configuredAppHost();
  const pathParts = pathname.split("/").filter(Boolean);
  const pathSlug = pathParts[0] || "";
  const reservedSubdomains = new Set(["app", "api", "go", "play", "wiki", "www"]);

  if (host === pathHost && pathSlug) {
    return { type: "path", slug: pathSlug.toLowerCase() };
  }

  if (host === "localhost" && pathParts[0] === "r" && pathParts[1]) {
    return { type: "path", slug: pathParts[1].toLowerCase() };
  }

  if (appHost && host === appHost) {
    return { type: "none" };
  }

  if (host.endsWith(`.${baseDomain}`)) {
    const label = host.slice(0, -(baseDomain.length + 1));
    if (label && !label.includes(".") && !reservedSubdomains.has(label)) {
      return { type: "subdomain", slug: label.toLowerCase() };
    }
  }

  if (host.endsWith(".localhost")) {
    const label = host.slice(0, -".localhost".length);
    if (label && !label.includes(".")) {
      return { type: "subdomain", slug: label.toLowerCase() };
    }
  }

  return { type: "none" };
}
