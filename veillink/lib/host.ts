import { product } from "@/lib/config";

export type RouteMatch =
  | { type: "path"; slug: string }
  | { type: "subdomain"; slug: string }
  | { type: "none" };

function hostWithoutPort(host: string) {
  return host.toLowerCase().split(":")[0];
}

export function parseRedirectRequest(hostHeader: string, pathname: string): RouteMatch {
  const host = hostWithoutPort(hostHeader);
  const baseDomain = product.baseDomain.toLowerCase();
  const pathHost = product.pathHost.toLowerCase();
  const pathParts = pathname.split("/").filter(Boolean);
  const pathSlug = pathParts[0] || "";

  if (host === pathHost && pathSlug) {
    return { type: "path", slug: pathSlug.toLowerCase() };
  }

  if (host === "localhost" && pathParts[0] === "r" && pathParts[1]) {
    return { type: "path", slug: pathParts[1].toLowerCase() };
  }

  if (host.endsWith(`.${baseDomain}`)) {
    const label = host.slice(0, -(baseDomain.length + 1));
    if (label && !label.includes(".") && label !== "go") {
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
