import { forwardRef } from "react";
import {
  InternationalPhoneField,
  type InternationalPhoneFieldProps,
} from "../../components/InternationalPhoneField";

type PatientPhoneFieldProps = Omit<
  InternationalPhoneFieldProps,
  "label" | "countrySelectLabel" | "hint" | "autoComplete"
>;

export const PatientPhoneField = forwardRef<
  HTMLInputElement,
  PatientPhoneFieldProps
>(({ ...props }, ref) => (
  <InternationalPhoneField
    ref={ref}
    {...props}
    label="WhatsApp"
    countrySelectLabel="País ou região do WhatsApp"
    hint="Selecione o país e digite o número com DDD."
    autoComplete="tel-national"
  />
));

PatientPhoneField.displayName = "PatientPhoneField";
