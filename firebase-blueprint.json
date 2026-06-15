import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCLPRUT(rut: string) {
  if (!rut) return "";
  let value = rut.replace(/\./g, "").replace("-", "");
  if (value.length < 2) return value;
  let body = value.slice(0, -1);
  let dv = value.slice(-1).toUpperCase();
  body = body.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  return `${body}-${dv}`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount);
}
