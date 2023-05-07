import csv
import json
import re
import numpy
import os.path
import pdb

# python prepare_data_traits.py -n ../data_past_org/now_export_locsp_public_2022-07-23T11#31#34+0000.csv -l ../data_past_org/localities_org.csv -t ../data_past_org/species_traits_past.csv -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -m ../data_past_prepared/sites_traits_meta_past.csv -q ../data_past_org/localities_more.csv -p ../data_past_prepared/localities_list.csv

CMP_OPS = {">": numpy.greater, "<": numpy.less,
          ">=": numpy.greater_equal, "<=": numpy.less_equal,
          "==": numpy.equal, "!=": numpy.not_equal}

def get_compare(data_vec, thres=0, cmp_op=">="):
    if cmp_op in CMP_OPS:
        return CMP_OPS[cmp_op](data_vec, thres)
    elif callable(cmp_op):
        return cmp_op(data_vec, thres)
    return numpy.array([cmp_op for i in range(data_vec.shape[0])])
        
def get_line_params(xyA, xyB):
    ((xA, yA), (xB, yB)) = (xyA, xyB)
    if xB != xA:
        coeffx = (yB-yA)/(xB-xA)
        coeffy = -1
        coeffc = (xB*yA-yB*xA)/(xB-xA)
        coeffs = numpy.array([coeffx, coeffy, coeffc])
        if coeffc < 0:
            coeffs *= -1        
        
        ff = numpy.array([1, -coeffs[0]/coeffs[1]])
        p0 = numpy.array([0, -coeffs[-1]/coeffs[1]])
        V = numpy.outer(ff, ff)/numpy.dot(ff, ff)
        offs = numpy.dot((numpy.eye(V.shape[0]) - V), p0)
        return {"coeffs":coeffs, "offs": offs, "V": V}
    elif yB != yA:
        coeffx = -1
        coeffy = (xB-xA)/(yB-yA)
        coeffc = (yB*xA-xB*yA)/(yB-yA)
        coeffs = numpy.array([coeffx, coeffy, coeffc])
        if coeffc < 0:
            coeffs *= -1
        
        ff = numpy.array([-coeffs[1]/coeffs[0], 1])
        p0 = numpy.array([-coeffs[-1]/coeffs[0], 0])
        V = numpy.outer(ff, ff)/numpy.dot(ff, ff)
        offs = numpy.dot((numpy.eye(V.shape[0]) - V), p0)
        return {"coeffs":coeffs, "offs": offs, "V": V}

def get_signed_dist_line(data_array, xyA, xyB, xcid=0, ycid=1):
    lparams = get_line_params(xyA, xyB)
    if lparams is not None:
        proj = numpy.dot(data_array[:,(xcid, ycid)], lparams["V"]) + numpy.tile(lparams["offs"], (data_array.shape[0], 1))
        dist = numpy.sqrt(numpy.sum((data_array[:,(xcid, ycid)] - proj)**2, axis=1))
        side = numpy.sign(numpy.dot(data_array[:,(xcid, ycid)], lparams["coeffs"][:-1])+lparams["coeffs"][-1])
        return dist*side

### (longitude, latitude)
# ALL_LINES = {}
# ALL_LINES["GEO_LAT"] = {"lines": [{"xyA": (0, 28), "xyB": (1, 28)}],
#                         "map_ids": ["N","S"]}
# ALL_LINES["GEO_12"] = {"lines": [{"xyA": (106, 18), "xyB": (70, 36)}, {"xyA": (124, 43), "xyB": (87, 24)}],
#                        "map_ids": ["NW","o","SE","o"]}

def get_group_ids_lines(data_array, lines, map_ids=None):
    group_ids = numpy.zeros(data_array.shape[0], dtype=int)
    for li, line in enumerate(lines):
        sdists = get_signed_dist_line(data_array, line["xyA"], line["xyB"], line.get("xcid", 0), line.get("ycid", 1))
        group_ids += (2**li)*get_compare(sdists, line.get("thres", 0), line.get("cmp_op", ">="))
    if map_ids is not None:
        if type(map_ids) is dict: 
            return [map_ids.get(v, map_ids.get(-1)) for v in group_ids]
        return [map_ids[v] if v < len(map_ids) else map_ids[-1] for v in group_ids]
    return list(group_ids)

def load_json(json_file):
    dts = {}
    with open(json_file) as fi:
        dts = json.loads(fi.read())
    return dts
    
def load_plotlocs(plotlocs_file, plotlocs_sep=","):
    with open(plotlocs_file) as csvfile:
        reader = csv.DictReader(csvfile, delimiter=plotlocs_sep, skipinitialspace=True)
        return list(reader)

def load_traits(traits_file, keep_traits, key_species):
    data_traits = {}
    head_traits = None
    sep = "\t"
    with open(traits_file) as fp:
        for line in fp:
            parts = line.strip().split(traits_sep)
            if head_traits is None:
                head_traits = dict([(v.strip(), k) for (k, v) in enumerate(parts)])
                map_traits = dict([(v, k) for (k, v) in head_traits.items()])
            else:
                spc_k = tuple([parts[head_traits[k]].strip() for k in key_species])
                pp = []
                for pi, p in enumerate(parts):
                    if map_traits.get(pi) in keep_traits:
                        try:
                            pp.append(int(p))
                        except (ValueError, TypeError):
                            pp.append(None)
                    else:
                        pp.append(p)
                data_traits[spc_k] = pp
    return data_traits, head_traits


def load_occs(occs_file, locs_file, key_locs, key_species, atts_ll=None):
    data_occs = {}
    data_ll = {}
    head_occs = None
    head_locs = None
    spc_counts = {}
    sep = ","
    with open(locs_file) as fp:
        for line in fp:
            parts = line.strip().split(locs_sep)
            if head_locs is None:
                head_locs = dict([(v.strip(), k) for (k, v) in enumerate(parts)])
            else:
                loc_k = tuple([parts[head_locs[k]].strip() for k in key_locs])
                if loc_k[0] != "":
                    data_occs[loc_k] = set()
                    try:
                        spc_counts[loc_k] = int(parts[head_locs["NB_SPCS"]].strip())
                    except ValueError:
                        spc_counts[loc_k] = -1

    with open(occs_file) as fp:
        for line in fp:
            parts = line.strip().split(occs_sep)
            if head_occs is None:
                head_occs = dict([(v.strip(), k) for (k, v) in enumerate(parts)])
            else:
                loc_k = tuple([parts[head_occs[k]].strip() for k in key_locs])
                if loc_k in data_occs:
                    if atts_ll is not None:
                        if loc_k not in data_ll:
                            data_ll[loc_k] = [parts[head_occs[k]].strip() for k in atts_ll]+[1]
                        else:
                            data_ll[loc_k][-1] += 1
                    spc_k = tuple([parts[head_occs[k]].strip() for k in key_species])
                    data_occs[loc_k].add(spc_k)

    # for x, sp in data_occs.items():
    #     if spc_counts.get(x, -1) != len(sp):
    #         print(x, len(sp), spc_counts.get(x, -1))
    return data_occs, head_occs, data_ll


def aggregate_traits(agg_file, data_occs, data_traits, head_traits, keep_traits, meta_file=None):
    locs = sorted(data_occs.keys())
    if meta_file is not None:
        fo_meta = open(meta_file, "w")
    not_found_spc = {}

    with open(agg_file, "w") as fo:

        fo.write(out_sep.join(["ID"]+["MEAN_%s" % t for t in keep_traits]+["NB_SPC"])+" # type=N\n")
        fo.write(out_sep.join(["enabled_col"]+["T" for i in keep_traits])+",F\n")

        if fo_meta is not None:
            fo_meta.write(out_sep.join(["ID"]+["MEAN_%s" % t for t in keep_traits]+["NB_SPC", "SPC"])+" # type=N\n")
            fo_meta.write(out_sep.join(["enabled_col"]+["T" for i in keep_traits])+",F,F\n")

        for loc in locs:
            spcs = []
            for spc in data_occs[loc]:
                if spc in data_traits:
                    spcs.append(spc)
                elif spc[0] in orders:
                    not_found_spc[spc] = not_found_spc.get(spc, 0) + 1
            xps = [l for l in loc]
            xps_meta = [l for l in loc]
            # if ('Pachygazella', 'grangeri') in spcs:
            #     print(loc, spcs)
            #     pdb.set_trace()
            for trait in keep_traits:
                if trait in head_traits:
                    ti = head_traits[trait]
                    vals = [data_traits[spc][ti] for spc in spcs if data_traits[spc][ti] is not None]
                    xps_meta.append("%d" % len(vals))
                    if len(vals) > 0:
                        xps.append("%.3f" % numpy.mean(vals))
                    else:
                        xps.append(NA_val)
                else:
                    xps.append(NA_val)
            xps.append("%d" % len(spcs))
            fo.write(out_sep.join(xps)+"\n")
            # if ('Pachygazella', 'grangeri') in spcs:
            #     print(loc, spcs, xps_meta)

            if fo_meta is not None:
                xps_meta.append("%d" % len(spcs))
                xps_meta.append("\""+out_sep.join([" ".join(s) for s in sorted(spcs)])+"\"")
                fo_meta.write(out_sep.join(xps_meta)+"\n")

        print("NOT FOUND:", not_found_spc)

            
def add_locs_timeinter(data_locs, atts_locs, time_intervals):
    map_atts_locs = dict([(v, k) for (k, v) in enumerate(atts_locs)])
    
    for loc in data_locs.keys():
        min_age, max_age = float(data_locs[loc][map_atts_locs["MIN_AGE"]]), float(data_locs[loc][map_atts_locs["MAX_AGE"]])    
        periods = [ti for (ti, td) in enumerate(time_intervals) if
                    ((min_age >= td["min_min"]) and (min_age <= td["max_min"]) and (max_age >= td["min_max"]) and (max_age <= td["max_max"]))]

        if len(periods) != 1:
            print(loc, min_age, max_age, periods)
        data_locs[loc].append(periods[0])
    return [ATT_TIME_INTERVAL]
        
def add_locs_geogroups(data_locs, atts_locs, geo_lines):
    map_atts_locs = dict([(v, k) for (k, v) in enumerate(atts_locs)])
    lids = sorted(data_locs.keys())
    data_array = numpy.array([[float(data_locs[lid][map_atts_locs[a]]) for a in ["LONG", "LAT"]] for lid in lids])
    gnames = []
    for gname, gdata in geo_lines.items():
        group_ids = get_group_ids_lines(data_array, gdata["lines"], gdata.get("map_ids"))
        gnames.append(gname)
        
        for li, lid in enumerate(lids):
            data_locs[lid].append(group_ids[li])
    return gnames        
        
def save_data_locs(l_file, data_locs, key_locs, atts_locs=None, exts_ll=None, atts_extra=[], prev_plotlocs_file=None):
    if atts_locs is None:
        return

    map_atts_locs = dict([(v, k) for (k, v) in enumerate(atts_locs)])
    for i, l in enumerate(atts_extra):
        map_atts_locs[l] = len(atts_locs)+i

    if exts_ll is not None:
        X = numpy.array([[float(dt[map_atts_locs[ext]]) for ext in exts_ll] for loc, dt in data_locs.items()])
        print("\n".join(["%s:\t[%.3f, %.3f]" % (ext, minv, maxv) for (ext, minv, maxv) in zip(*[exts_ll, X.min(axis=0), X.max(axis=0)])]))

    data_prev = {}
    if prev_plotlocs_file is not None:
        data_prev = {}
        head_locs = None
        atts_prev = []
        atts_new = []
        with open(prev_plotlocs_file) as fp:
            for line in fp:
                parts = line.strip().split(ll_sep)
                if head_locs is None:
                    head_locs = dict([(v.strip(), k) for (k, v) in enumerate(parts)])
                    atts_prev = parts
                    atts_new = [x for x in atts_locs+atts_extra if x not in parts]
                else:
                    loc_k = tuple([parts[head_locs[k]].strip() for k in key_locs])
                    data_prev[loc_k] = [parts[head_locs[k]].strip() for k in atts_prev]

        locs = sorted(data_locs.keys())
        with open(l_file, "w") as fo:
            fo.write(ll_sep.join(atts_prev+atts_new)+"\n")
            for loc in locs:
                vals = []
                for ai, att in enumerate(atts_prev+atts_new):
                    if att in map_atts_locs:
                        if type(data_locs[loc][map_atts_locs[att]]) is int:
                            vals.append("%d" % data_locs[loc][map_atts_locs[att]])
                        else:
                            vals.append(data_locs[loc][map_atts_locs[att]])
                    elif ai < len(data_prev.get(loc, [])):
                        vals.append(data_prev[loc][ai])
                    else:
                        vals.append(ll_missing_tk)
                fo.write(ll_sep.join(vals)+"\n")

    else:
        locs = sorted(data_locs.keys())
        with open(l_file, "w") as fo:
            fo.write(ll_sep.join(atts_locs+atts_extra)+"\n")
            fo.write("\n".join([ll_sep.join(data_locs[loc][:-len(atts_extra)]+["%d" % d for d in data_locs[loc][-len(atts_extra):]]) for loc in locs]))


if __name__ == '__main__':

    import argparse

    parser = argparse.ArgumentParser(description='Aggregating dentral traits to prepare one side of dataset.')
    parser.add_argument("-n", "--now_dump", type=str, help="Latest NOW dump (input)", required=True)
    parser.add_argument("-l", "--localities", type=str, help="List of localities (input)", required=True)
    parser.add_argument("-t", "--traits", type=str, help="Species dental traits (input)", required=True)
    parser.add_argument("-d", "--dental_data", type=str, help="Aggregated dental traits per site (output)", required=True)
    parser.add_argument("-m", "--dental_meta", type=str, help="Metadata, species considered in aggregated dental traits for each site (output)", required=True)

    # gather localities info fresh from data dump, and prepare for pyplot
    parser.add_argument("-q", "--plotlocs_prev", type=str, help="Previous version of localities info for plotting (input)", default=argparse.SUPPRESS)
    parser.add_argument("-p", "--plotlocs", type=str, help="Localities info for plotting (output)", default=argparse.SUPPRESS)

    parser.add_argument("-I", "--time_intervals", type=str, help="Details of the time intervals (input)", default=argparse.SUPPRESS)
    parser.add_argument("-L", "--geo_lines", type=str, help="Details of the lines for splitting geographic areas (input)", default=argparse.SUPPRESS)

    params = vars(parser.parse_args())

    # keep_traits = ["HYP", "LOP", "HOD", "AL", "OL", "SF", "OT", "CM", "OO", "ETH", "LOPT"]
    keep_traits = ["HYP", "AL", "OL", "SF", "OT", "OO", "BU"]

    ll_sep = ","
    ll_missing_tk = "-"
    atts_ll = ["LIDNUM", "NAME", "LAT", "LONG", "MAX_AGE", "MIN_AGE"]
    exts_ll = ["LAT", "LONG", "MAX_AGE", "MIN_AGE"]
    ATT_NB_SPC = "NB_SPC"
    ATT_TIME_INTERVAL = "TIME_INTERVAL"

    traits_sep = "\t"
    occs_sep = "\t"
    locs_sep = ","

    out_sep = ","
    spc_sep = ","

    orders = ["Perissodactyla", "Artiodactyla", "Primates", "Proboscidea", "Hyracoidea"]
    key_species = ["ORDER", "FAMILY", "GENUS", "SPECIES"]
    key_locs = ["LIDNUM"]
    #NA_val = "NA"
    #NA_val = "nan"
    NA_val = "?"

    prep_folder = os.path.dirname(os.path.abspath(params["dental_data"]))
    if not os.path.exists(prep_folder):
        os.makedirs(prep_folder)

    data_traits, head_traits = load_traits(params["traits"], keep_traits, key_species)
    data_occs, head_occs, data_ll = load_occs(params["now_dump"], params["localities"], key_locs, key_species, atts_ll)

    aggregate_traits(params["dental_data"], data_occs, data_traits, head_traits, keep_traits, params["dental_meta"])
    if "plotlocs" in params:
        atts_extra = [ATT_NB_SPC]
        if params.get("time_intervals") is not None:
            time_intervals = load_json(params["time_intervals"])
            atts_timeinters = add_locs_timeinter(data_ll, atts_ll, time_intervals)
            atts_extra.extend(atts_timeinters)

        if params.get("geo_lines") is not None:
            geo_lines = load_json(params["geo_lines"])
            atts_groups = add_locs_geogroups(data_ll, atts_ll, geo_lines)        
            atts_extra.extend(atts_groups)

        save_data_locs(params["plotlocs"], data_ll, key_locs, atts_ll, exts_ll, atts_extra, params.get("plotlocs_prev"))
