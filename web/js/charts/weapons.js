// #weapons - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export function weapons(el, { data }) {
  placeholder(el, "weapons/weapons", data.weapon_class, data.kpi);
}
