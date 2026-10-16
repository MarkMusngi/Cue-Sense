"use client";

import type { ButtonHTMLAttributes } from "react";

import { buttonClasses, type ButtonVariant } from "./button-styles";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  "data-testid"?: string;
};

/** The app's button: at least 44 px tall, never a form submit unless asked. */
export function Button({
  variant = "secondary",
  type = "button",
  className,
  "data-testid": testId = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      className={buttonClasses(variant, className)}
      {...rest}
    />
  );
}
