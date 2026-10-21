// #home - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function title() {}  // static markup in index.html

export function kpi(el, { data }) {
  placeholder(el, "home/kpi", data.kpi, data.monthly_by_cat);
}
