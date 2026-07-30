"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductAccountLink } from "@/components/ProductAccountLink";
import {
  RIGHTS_PRODUCT_ADVISOR_LABEL,
  RIGHTS_PRODUCT_ADVISOR_PATH,
  RIGHTS_PRODUCT_CREATE_PATH,
  RIGHTS_PRODUCT_REGISTRY_PATH,
  RIGHTS_PRODUCT_RESOURCES_LABEL,
  RIGHTS_PRODUCT_RESOURCES_PATH,
  RIGHTS_PRODUCT_STUDIO_OVERVIEW,
} from "@/lib/rights/product-nav";

type Props = {
  signedIn: boolean;
};

/**
 * Product chrome for Creator Rights routes only (/rights/*).
 * Keeps Account → /account/rights consistent without cockpit-ifying Studio headers.
 */
export function RightsProductChrome({ signedIn }: Props) {
  const pathname = usePathname() || "/rights";

  if (pathname.startsWith(RIGHTS_PRODUCT_CREATE_PATH) || pathname.startsWith(RIGHTS_PRODUCT_ADVISOR_PATH)) return null;

  return (
    <div className="rights-product-chrome" data-product="creator-rights">
      <nav className="rights-product-nav" aria-label="Creator Rights">
        <Link className="rights-product-brand" href={RIGHTS_PRODUCT_REGISTRY_PATH}>
          Creator Rights
        </Link>
        <div className="rights-product-links">
          <a className="rights-product-link" href={RIGHTS_PRODUCT_STUDIO_OVERVIEW} target="_blank" rel="noopener noreferrer">
            Overview
          </a>
          <Link
            className="rights-product-link"
            href={RIGHTS_PRODUCT_REGISTRY_PATH}
            aria-current={pathname === "/rights" ? "page" : undefined}
          >
            Records
          </Link>
          <a className="rights-product-link" href={RIGHTS_PRODUCT_RESOURCES_PATH} target="_blank" rel="noopener noreferrer">
            {RIGHTS_PRODUCT_RESOURCES_LABEL}
          </a>
          <ProductAccountLink
            product="rights"
            signedIn={signedIn}
            className="rights-product-link rights-product-account"
            returnTo={pathname}
          />
          <Link
            className="button rights-product-register"
            href={RIGHTS_PRODUCT_ADVISOR_PATH}
            aria-current={pathname.startsWith("/rights/advisor") ? "page" : undefined}
          >
            {RIGHTS_PRODUCT_ADVISOR_LABEL}
          </Link>
        </div>
      </nav>
    </div>
  );
}
