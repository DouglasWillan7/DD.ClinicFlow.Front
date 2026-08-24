import clsx from "clsx";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parseDigits,
  parseIncompletePhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { ChevronDown } from "lucide-react";
import { forwardRef, useState } from "react";
import styles from "./PatientPhoneField.module.css";

interface PatientPhoneFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  className?: string;
  id?: string;
}

interface PhoneCountry {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

const defaultCountry: CountryCode = "BR";
const regionNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

function countryFlag(country: CountryCode) {
  return [...country]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

const countries: PhoneCountry[] = getCountries()
  .map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
    flag: countryFlag(code),
  }))
  .sort((first, second) => {
    if (first.code === defaultCountry) return -1;
    if (second.code === defaultCountry) return 1;
    return first.name.localeCompare(second.name, "pt-BR");
  });

function getInitialPhone(value: string) {
  const digits = parseDigits(value);
  if (!digits) {
    return { country: defaultCountry, nationalValue: "" };
  }

  const internationalValue = value.trim().startsWith("+")
    ? value
    : `+${digits}`;
  const parsed = parsePhoneNumberFromString(internationalValue);
  if (parsed?.country) {
    return {
      country: parsed.country,
      nationalValue: parsed.formatNational(),
    };
  }

  return {
    country: defaultCountry,
    nationalValue: new AsYouType(defaultCountry).input(digits),
  };
}

export const PatientPhoneField = forwardRef<
  HTMLInputElement,
  PatientPhoneFieldProps
>(
  (
    { name, value, onChange, onBlur, error, className, id },
    ref,
  ) => {
    const initialPhone = getInitialPhone(value);
    const [country, setCountry] = useState<CountryCode>(initialPhone.country);
    const [nationalValue, setNationalValue] = useState(
      initialPhone.nationalValue,
    );
    const selectedCountry =
      countries.find((option) => option.code === country) ?? countries[0];
    const inputId = id ?? name;
    const errorId = `${inputId}-error`;

    function updateNationalValue(nextValue: string, nextCountry = country) {
      const digits = parseDigits(nextValue);
      const formatter = new AsYouType(nextCountry);
      const formatted = formatter.input(digits);
      setNationalValue(formatted);
      onChange(formatter.getNumberValue() ?? "");
    }

    function updateInput(rawValue: string) {
      const incomplete = parseIncompletePhoneNumber(rawValue);
      if (incomplete.startsWith("+")) {
        const formatter = new AsYouType();
        formatter.input(incomplete);
        const detectedCountry = formatter.getCountry();
        const number = formatter.getNumber();
        if (detectedCountry && number) {
          setCountry(detectedCountry);
          setNationalValue(number.formatNational());
          onChange(formatter.getNumberValue() ?? "");
          return;
        }
      }

      updateNationalValue(rawValue);
    }

    function updateCountry(nextCountry: CountryCode) {
      setCountry(nextCountry);
      updateNationalValue(nationalValue, nextCountry);
    }

    return (
      <div className={clsx(styles.field, className)}>
        <label htmlFor={inputId}>WhatsApp</label>
        <div
          className={clsx(styles.control, error && styles.invalid)}
          data-phone-control
        >
          <span className={styles.countryPicker}>
            <span className={styles.countryValue} aria-hidden="true">
              <span className={styles.flag}>{selectedCountry.flag}</span>
              <span>+{selectedCountry.callingCode}</span>
              <ChevronDown size={15} strokeWidth={1.8} />
            </span>
            <select
              aria-label="País ou região do WhatsApp"
              value={country}
              onChange={(event) =>
                updateCountry(event.target.value as CountryCode)
              }
              data-phone-country
            >
              {countries.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.name} (+{option.callingCode})
                </option>
              ))}
            </select>
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Número com DDD"
            maxLength={24}
            value={nationalValue}
            onChange={(event) => updateInput(event.target.value)}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : `${inputId}-hint`}
            data-phone-input
          />
        </div>
        {error ? (
          <small id={errorId} className={styles.error}>
            {error}
          </small>
        ) : (
          <small id={`${inputId}-hint`}>
            Selecione o país e digite o número com DDD.
          </small>
        )}
      </div>
    );
  },
);

PatientPhoneField.displayName = "PatientPhoneField";
