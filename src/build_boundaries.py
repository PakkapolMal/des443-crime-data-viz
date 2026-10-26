"""Simplify map boundaries into data/processed/nibrs/boundaries.json (GeoJSON).

Inputs (downloaded once, read-only, in data/raw/geo/):
  city/la_city_boundary.geojson         City of LA boundary, data.lacity.org dataset brvb-jr45 (CC0)
  state/cb_2023_us_state_500k_kml.zip   US Census 2023 cartographic state boundaries, 1:500k,
                                        shoreline-clipped (public domain)
Features out, by `name`:
  "city"  City of LA outer edge (LAPD jurisdiction); enclaves such as Beverly Hills and Culver
          City are dropped so the map reads as one shape
  "land"  California land around LA, clipped to LAND_BBOX; everything else on the map is ocean
"""
import argparse
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, box, mapping, shape

LAND_BBOX = (-121.0, 32.5, -116.0, 35.5)  # lon/lat window around LA, wider than the zoomed-out 16:9 frame
TOLERANCE = 0.0005                        # degrees, ~50 m: invisible at the map's scale
KML = "{http://www.opengis.net/kml/2.2}"


def california(kml_zip):
    """California polygons from the Census KML (stdlib XML; no shapefile library needed)."""
    with zipfile.ZipFile(kml_zip) as z:
        root = ET.fromstring(z.read(next(n for n in z.namelist() if n.endswith(".kml"))))
    for pm in root.iter(f"{KML}Placemark"):
        if any(d.text == "California" for d in pm.iter(f"{KML}SimpleData")):
            polys = []
            for p in pm.iter(f"{KML}Polygon"):
                rings = [[tuple(map(float, c.split(",")[:2])) for c in r.text.split()]
                         for r in p.iter(f"{KML}coordinates")]
                polys.append(Polygon(rings[0], rings[1:]))
            return MultiPolygon(polys)
    raise ValueError("California not found in KML")


def rounded(geom):
    """GeoJSON geometry with 5-decimal coordinates (~1 m) to keep the file small."""
    def r(c):
        return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], float) else [r(x) for x in c]
    g = mapping(geom)
    return {"type": g["type"], "coordinates": r(json.loads(json.dumps(g["coordinates"])))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw/geo")
    ap.add_argument("--output", default="data/processed/nibrs/boundaries.json")
    a = ap.parse_args()
    raw = Path(a.raw)

    city = shape(json.load(open(raw / "city/la_city_boundary.geojson"))["features"][0]["geometry"])
    parts = getattr(city, "geoms", [city])
    holes = sum(len(p.interiors) for p in parts)
    city = MultiPolygon([Polygon(p.exterior) for p in parts])
    land = california(raw / "state/cb_2023_us_state_500k_kml.zip").intersection(box(*LAND_BBOX))

    out = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"name": name},
         "geometry": rounded(geom.simplify(TOLERANCE, preserve_topology=True))}
        for name, geom in [("city", city), ("land", land)]
    ]}
    Path(a.output).write_text(json.dumps(out, separators=(",", ":")))
    size = Path(a.output).stat().st_size / 1024
    print(f"{a.output}: {size:.0f} KB; dropped {holes} enclave holes; city bounds {tuple(round(v, 3) for v in city.bounds)}")
    assert size < 2048, "boundaries.json over the 2 MB output limit"


if __name__ == "__main__":
    main()
