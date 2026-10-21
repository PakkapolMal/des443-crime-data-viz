// #outcomes - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function funnel(el, { data }) {
  placeholder(el, "outcomes/funnel", data.outcome_funnel, data.outcome_by_cat);
}

export function lag(el, { data }) {
  placeholder(el, "outcomes/lag", data.report_lag_by_cat);
}
