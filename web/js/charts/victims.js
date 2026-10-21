// #victims - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function pyramid(el, { data }) {
  placeholder(el, "victims/pyramid", data.victim_age_sex, data.victim_type);
}

export function descent(el, { data }) {
  placeholder(el, "victims/descent", data.victim_descent_by_cat);
}
