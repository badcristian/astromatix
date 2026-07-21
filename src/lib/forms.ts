// Shared form-field shape, so the form stub, its wrappers (ContactCta), and the
// data layer (klantcases) all speak the same type instead of falling back to
// `any[]` at each boundary.

export interface Field {
  name: string;
  type: string;
  label: string;
  required: boolean;
  /** For a checkbox/radio: this option's label and the group legend. */
  option?: string | null;
  group?: string | null;
}
