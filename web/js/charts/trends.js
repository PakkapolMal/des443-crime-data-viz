// #trends - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function monthly(el, { data }) {
  placeholder(el, "trends/monthly", data.monthly_by_cat);
}

export function weekly(el, { data }) {
  placeholder(el, "trends/weekly", data.dow_by_cat, data.flags_monthly);
}
