// #about - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function about(el, { data }) {
  placeholder(el, "about/about", data.kpi);
}
