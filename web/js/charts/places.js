// #places - see TASK.md. One export per screen: (el, { data, lazy }) => void.
import { placeholder } from "../util.js";

export async function map(el, { lazy }) {
  const [grid, sample] = await Promise.all([lazy("geo_grid"), lazy("geo_sample")]);
  placeholder(el, "places/map", grid, sample);
}

export function areas(el, { data }) {
  placeholder(el, "places/areas", data.area_summary, data.area_by_cat);
}

export function locations(el, { data }) {
  placeholder(el, "places/locations", data.top_locations);
}
