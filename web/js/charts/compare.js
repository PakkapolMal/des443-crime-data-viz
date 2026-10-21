// #compare - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function scatter(el, { data }) {
  placeholder(el, "compare/scatter", data.area_summary, data.flags_by_area);
}
