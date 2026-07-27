"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductAccountLink } from "@/components/ProductAccountLink";
import {
  RIGHTS_PRODUCT_CREATE_PATH,
  RIGHTS_PRODUCT_REGISTRY_PATH,
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

  return (
    <div className="rights-product-chrome" data-product="creator-rights">
      <nav className="rights-product-nav" aria-label="Creator Rights">
        <Link className="rights-product-brand" href={RIGHTS_PRODUCT_REGISTRY_PATH}>
          Creator Rights
        </Link>
        <div className="rights-product-links">
          <a href={RIGHTS_PRODUCT_STUDIO_OVERVIEW} target="_blank" rel="noopener noreferrer">
            Overview
          </a>
          <Link href={RIGHTS_PRODUCT_REGISTRY_PATH} aria-current={pathname === "/rights" ? "page" : undefined}>
            Records
          </Link>
          <Link
            href={RIGHTS_PRODUCT_CREATE_PATH}
            aria-current={pathname.startsWith("/rights/create") ? "page" : undefined}
          >
            Create
          </Link>
          <ProductAccountLink
            product="rights"
            signedIn={signedIn}
            className="button secondary rights-product-account"
            returnTo={pathname}
          />
        </div>
      </nav>
    </div>
  );
}
