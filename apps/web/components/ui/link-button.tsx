import Link from "next/link";
import type { ComponentProps } from "react";

import { buttonClasses, type ButtonVariant } from "./button-styles";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  className?: string;
  "data-testid"?: string;
};

/** A link that looks like a Button, for actions that go to another page. */
export function LinkButton({
  variant = "secondary",
  className,
  "data-testid": testId = "link-button",
  ...rest
}: LinkButtonProps) {
  return <Link data-testid={testId} className={buttonClasses(variant, className)} {...rest} />;
}
