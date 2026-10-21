// #offenses - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function hierarchy(el, { data }) {
  placeholder(el, "offenses/hierarchy", data.offense_hierarchy, data.top_offenses);
}

export function cooccurrence(el, { data }) {
  placeholder(el, "offenses/cooccurrence", data.offense_cooccurrence, data.offense_count_dist);
}
