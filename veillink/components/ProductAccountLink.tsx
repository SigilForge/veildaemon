import Link from "next/link";
import {
  RIGHTS_PRODUCT_ACCOUNT_LABEL,
  RIGHTS_PRODUCT_ACCOUNT_PATH,
  rightsProductAccountHref,
  rightsProductLoginHref,
} from "@/lib/rights/product-nav";
import { QR_PRODUCT_ACCOUNT_LABEL, qrProductAccountHref, qrProductLoginHref } from "@/lib/product-nav";

type Product = "qr" | "rights";

type Props = {
  product: Product;
  /** When true, signed-out users go to login with next=account path. */
  signedIn: boolean;
  className?: string;
  /** Optional return path for rights product deep-links after login. */
  returnTo?: string;
};

/**
 * Shared Account control for product headers.
 * QR product → /account · Creator Rights product → /account/rights
 */
export function ProductAccountLink({ product, signedIn, className, returnTo }: Props) {
  if (product === "rights") {
    const href = signedIn
      ? rightsProductAccountHref({ returnTo })
      : rightsProductLoginHref(returnTo || RIGHTS_PRODUCT_ACCOUNT_PATH);
    return (
      <Link className={className} href={href}>
        {RIGHTS_PRODUCT_ACCOUNT_LABEL}
      </Link>
    );
  }

  const href = signedIn ? qrProductAccountHref() : qrProductLoginHref();
  return (
    <Link className={className} href={href}>
      {QR_PRODUCT_ACCOUNT_LABEL}
    </Link>
  );
}
