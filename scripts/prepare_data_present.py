import re
import numpy
import os
import pdb

import argparse

# python prepare_data_present.py -i ../data_present_org/ -o ../data_present_prepared/ -s extended

def prepare_dyn_vars():
    vars_exps = [("bioX0:PDiffWetDryM", "abs(x['bio13:PWetM'] - x['bio14:PDryM'])"),
                 ("bioX1:NPP", "x['NPP']"),
                 ("bioX2:NPPt", "x['NPPt']", "F"),
                 ("bioX3:NPPp", "x['NPPp']"),
                 ("bioX4:NPPtSlack", "x['NPPt']-x['NPP']"),
                 ("bioX5:NPPpSlack", "x['NPPp']-x['NPP']"),
                 ("Z:Continent", "x['continent']")]

    additional_bio_vars = [{"name": "bioX0:PDiffWetDryM", "fmt": "%.2f", "FT": "F"},
                           {"name": "bioX1:NPP", "fmt": "%.2f", "FT": "F"},
                           {"name": "bioX2:NPPt", "fmt": "%.2f", "FT": "F"},
                           {"name": "bioX3:NPPp", "fmt": "%.2f", "FT": "F"},
                           {"name": "bioX4:NPPtSlack", "fmt": "%.2f", "FT": "F"},
                           {"name": "bioX5:NPPpSlack", "fmt": "%.2f", "FT": "F"},
                           {"name": "Z:Continent", "fmt": "%s", "FT": "F"}, ]

    AREAS_B = [("ASIA North-East block", "Rectangle:NorthEast", (80, 125, 20, 35)),
               ("ASIA South-East block", "Rectangle:SouthEast", (90, 115, 10, 20)),
               ("ASIA South-West block", "Rectangle:SouthWest", (66, 90, 5, 28)),
               ("ASIA North-West block", "Rectangle:NorthWest", (67.5, 90, 28, 37.5)),
               ("ASIA North-Mid block", "Rectangle:NorthMid", (80, 120, 35, 40))]

    AREAS_X = [("ASIA North-East ext", "Rectangle:ExtensionNorthEast", (130, 142, 42, 50)),
               ("ASIA North-Center ext", "Rectangle:ExtensionNorthMid", (125, 130, 42, 50)),
               ("ASIA Korea ext", "Rectangle:ExtensionKorea", (125, 130, 30, 42)),
               ("ASIA West ext", "Rectangle:ExtensionWest", (67.5, 125, 36, 50))]

    # AREAS_X = [("ASIA North block", "Rectangle:NX", (67.5, 150, 30, 50))]
    # AREAS_X = [("ASIA North block", "Rectangle:NX", (67.5, 150, 30, 90))]

    AREAS_C = [("Southern China", "Rectangle:SouthChina", (100, 120, 20, 30)),
               ("South East Asia", "Rectangle:SouthEastAsia", (90, 115, 10, 20)),
               ("Tibetan Plateau", "Rectangle:TibetPlateau", (70, 105, 28, 40)),
               ("India", "Rectangle:India", (70, 90, 5, 28)),
               ("Outer", "Rectangle:Outer", (65, 125, 5, 41))]

    for area in AREAS_B+AREAS_X:
        vars_exps.append((area[1], "True if (x['longitude'] > %f) and (x['longitude'] <= %f) and (x['latitude'] > %f) and (x['latitude'] <= %f) else False" % area[-1]))

    str_dj = " or ".join(["x['%s']" % area[1] for area in AREAS_B])
    vars_exps.append(("Z:AsiaFocus", "'In' if (%s) else 'Out'" % str_dj))
    str_dj = " or ".join(["x['%s']" % area[1] for area in AREAS_B+AREAS_X])
    vars_exps.append(("Z:ExtendedFocus", "'In' if (%s) else 'Out'" % str_dj))
    additional_bio_vars.extend([{"name": "Z:AsiaFocus", "fmt": "%s", "FT": "F"},  {"name": "Z:ExtendedFocus", "fmt": "%s", "FT": "F"}, ])

    # for area in AREAS_C:
    for area in AREAS_B+AREAS_X:
        vars_exps.append((area[1], "'In' if (x['longitude'] > %f) and (x['longitude'] <= %f) and (x['latitude'] > %f) and (x['latitude'] <= %f) else 'Out'" % area[-1]))
        additional_bio_vars.append({"name": area[1], "fmt": "%s", "FT": "F"})
    return additional_bio_vars, vars_exps

def var_eval(exp, row):
    return eval(exp, {}, {"x": row})


def getAddVarsStr(row_parts, heads_li, continent, additional_bio_vars, vars_exps):
    row = {}
    for fi, f in heads_li.items():
        try:
            row[fi] = float(row_parts[f])
        except ValueError:
            row[fi] = numpy.nan
    row["NPPt"] = 3000/(1+numpy.exp(1.315-0.119*row["bio1:TMeanY"]))
    row["NPPp"] = 3000*(1-numpy.exp(-0.000664*row["bio12:PTotY"]))
    row["NPP"] = numpy.minimum(row["NPPt"], row["NPPp"])
    row["continent"] = "C:%s" % continent

    for v in vars_exps:  # CANNOT MAKE IT DICT, ODER MATTERS
        row[v[0]] = var_eval(v[1], row)
    return ",".join([av.get("fmt", "%s") % row[av["name"]] for av in additional_bio_vars])


def getAddVars(row_parts, heads_li, continent, additional_bio_vars, vars_exps):
    row = {}
    for fi, f in heads_li.items():
        try:
            row[fi] = float(row_parts[f])
        except ValueError:
            row[fi] = numpy.nan

    row["NPPt"] = 3000/(1+numpy.exp(1.315-0.119*row["bio1:TMeanY"]))
    row["NPPp"] = 3000*(1-numpy.exp(-0.000664*row["bio12:PTotY"]))
    row["NPP"] = numpy.minimum(row["NPPt"], row["NPPp"])
    row["continent"] = "C:%s" % continent

    for v in vars_exps:  # CANNOT MAKE IT DICT, ODER MATTERS
        row[v[0]] = var_eval(v[1], row)
    return row


def load_legend_bio(bio_legend_file):
    leg = {}
    with open(bio_legend_file) as fp:
        for line in fp:
            parts = line.strip().split("=")
            leg[parts[0].strip()] = parts[0].strip()+":"+parts[1].strip()
    return leg


def load_lines_bio(bio_file, remove_vars, key_var, trans_vars={}):
    lines_bio = {}
    key_col = None
    sep = ","
    with open(bio_file) as fp:
        for line in fp:
            parts = line.strip().split(sep)
            if key_col is None:
                key_col = parts.index(key_var)
                keep_cols = [key_col]+[k for (k, v) in enumerate(parts) if v not in remove_vars+[key_var]]
                lines_bio[None] = sep.join([trans_vars.get(parts[k], parts[k]) for k in keep_cols])+"\n"
            else:
                lines_bio[parts[key_col]] = sep.join([parts[k] for k in keep_cols])+"\n"
    return lines_bio


def load_traits(traits_file, keep_traits, key_species, keep_taxo=[]):
    data_taxo = {}
    data_traits = {}
    head_traits = None
    sep = "\t"
    with open(traits_file) as fp:
        for line in fp:
            parts = line.strip().split(sep)
            if head_traits is None:
                head_traits = dict([(v, k) for (k, v) in enumerate(parts)])
            else:
                if True:
                    values = []
                    for kv in keep_traits:
                        tmp = re.match("(?P<trait>.*):(?P<val>[0-9]+)$", kv)
                        if tmp is not None:
                            if parts[head_traits[tmp.group("trait")]] == NA_val:
                                print(parts[head_traits[key_species]], kv, "MISSING")
                                values.append(0)
                            else:
                                values.append(1*(parts[head_traits[tmp.group("trait")]] == tmp.group("val")))
                        else:
                            if parts[head_traits[kv]] == NA_val:
                                print(parts[head_traits[key_species]], kv, "MISSING")
                                values.append(0)
                            else:
                                values.append(int(parts[head_traits[kv]]))
                    data_traits[parts[head_traits[key_species]]] = values
                # except ValueError:
                #     print(parts[head_traits[key_species]], "MISSING")
                data_taxo[parts[head_traits[key_species]]] = [parts[head_traits[kv]] for kv in keep_taxo]

    return data_traits, head_traits, data_taxo


def aggregate_traits(occurence_file, agg_file, data_traits, keep_traits, sid_to_spcs, map_traits=None):
    data_occurence = {}
    head_occurence = None

    sep = ","
    fo = open(agg_file, "w")
    with open(occurence_file) as fp:
        for line in fp:
            parts = line.strip().split(sep)
            if head_occurence is None:
                head_occurence = dict([(k, v) for (k, v) in enumerate(parts)])
                fo.write(",".join(["ID"]+["MEAN_%s" % re.sub("FCT_", "", t) for t in keep_traits]+["NB_SPC"])+"\n")
                fo.write(",".join(["enabled_col"]+["T" for i in keep_traits])+",F\n")

            elif parts[0] in sid_to_spcs:
                try:
                    present = [head_occurence[i] for (i, v) in enumerate(parts) if v == "1"]
                except ValueError:
                    print(line)
                    pdb.set_trace()

                if map_traits is None:
                    data_mat = numpy.array([data_traits[p] for p in present])
                else:
                    data_mat = numpy.array([[data_traits[p][map_traits[t]] for t in keep_traits] for p in present])
                if data_mat.shape[0] == 0:
                    fo.write(",".join([parts[0]]+["0" for t in keep_traits]+["0"])+"\n")
                else:
                    fo.write(",".join([parts[0]]+["%.3f" % t for t in data_mat.mean(axis=0)]+["%d" % data_mat.shape[0]])+"\n")
    fo.close()


def aggregate_traits_multi(occurence_file, agg_file, traits_sets, sid_to_spcs, with_spc_list=False):
    data_occurence = {}
    head_occurence = None
    set_spcs = set()

    sep = ","
    fo = open(agg_file, "w")
    with open(occurence_file) as fp:
        for line in fp:
            parts = line.strip().split(sep)
            if head_occurence is None:
                head_occurence = dict([(k, v) for (k, v) in enumerate(parts)])

                vnames = ["ID", "NB_SPC"]
                enable_flags = ["enabled_col", "F"]

                for traits_set in traits_sets:

                    vnames.extend([traits_set.get("pref_traits", "MEAN_%s") % re.sub("FCT_", "", t) for t in traits_set["keep_traits"]])
                    def_flag = "T" if traits_set.get("enable_traits", False) else "F"
                    enable_flags.extend([def_flag for t in traits_set["keep_traits"]])

                fo.write(",".join(vnames)+"\n")
                fo.write(",".join(enable_flags)+"\n")

            elif parts[0] in sid_to_spcs:
                try:
                    present = [head_occurence[i] for (i, v) in enumerate(parts) if v == "1"]
                except ValueError:
                    print(line)
                    pdb.set_trace()

                set_spcs.update(present)

                row = [parts[0], "%d" % len(present)]
                rows_spc = []
                for ti, traits_set in enumerate(traits_sets):
                    if traits_set.get("map_traits") is None:
                        data_mat = numpy.array([data_traits[p] for p in present])
                    else:
                        data_mat = numpy.array([[traits_set["data_traits"][p][traits_set["map_traits"][t]] for t in traits_set["keep_traits"]] for p in present])
                    if data_mat.shape[0] == 0:
                        row.extend(["0" for t in traits_set["keep_traits"]])
                    else:
                        if with_spc_list:
                            if ti == 0:
                                rows_spc = [["%s %s" % (parts[0], s), "-1"] for si, s in enumerate(present)]
                            for si, s in enumerate(present):
                                rows_spc[si].extend(["%.3f" % t for t in data_mat[si, :]])

                        row.extend(["%.3f" % t for t in data_mat.mean(axis=0)])
                for row_spc in rows_spc:
                    fo.write(",".join(row_spc)+"\n")
                fo.write(",".join(row)+"\n")
    fo.close()
    return set_spcs


def collect_occurrence(occurence_file, sids, min_nbsp=0):
    head_occurence = None
    sep = ","
    sid_to_spcs = {}
    with open(occurence_file) as fp:
        for line in fp:
            parts = line.strip().split(sep)
            if head_occurence is None:
                head_occurence = list(parts[1:])
            elif parts[0] in sids:
                present = [i for (i, v) in enumerate(parts[1:]) if v == "1"]
                if len(present) >= min_nbsp:
                    sid_to_spcs[parts[0]] = present
    return sid_to_spcs, head_occurence


def writeout_bio(bio_file, lines_bio, additional_bio_vars={}, vars_exps=[], sorted_sids=None):
    head_bio = None
    with open(bio_file, "w") as fo:
        fo.write(lines_bio[None].strip("\n")+","+",".join([adv["name"] for adv in additional_bio_vars])+"\n")
        head_bio = dict([(v, k) for (k, v) in enumerate(lines_bio[None].strip().split(","))])
        fo.write(",".join(["enabled_col"] +
                          ["T" for i in range(len(head_bio)-1)] +
                          [adv["FT"] for adv in additional_bio_vars])+"\n")

        if sorted_sids is None:
            sorted_sids = sorted([k for k in lines_bio.keys() if k is not None])
        for k in sorted_sids:
            line_bio = lines_bio[k]
            parts = line_bio.strip().split(",")
            add_vars_str = getAddVarsStr(parts, head_bio, "EU", additional_bio_vars, vars_exps)
            fo.write(line_bio.strip('\n') + "," + add_vars_str + "\n")


def writeout_spc(occurence_file, sid_to_spcs, map_sids, species_names):
    with open(occurence_file, "w") as fo:
        fo.write("\"id\",\"cid\",\"value\",\"type=B\"\n")
        for ci, spc in enumerate(species_names):
            fo.write("-1,%d,\"%s\"\n" % (ci, spc))
        for sid, ci in map_sids.items():
            fo.write("%d,-1,\"%s\"\n" % (ci, sid))
        for sid, spcis in sid_to_spcs.items():
            for spci in spcis:
                fo.write("%d,%d,1\n" % (map_sids[sid], spci))


def writeout_taxo(occurence_file, sid_to_spcs, map_sids, species_names, data_taxo, uniq_taxo):
    with open(occurence_file, "w") as fo:
        ci = len(species_names)
        head_taxo = ["ID"]
        for i, txs in enumerate(uniq_taxo):
            head_taxo.extend(txs)
        fo.write(",".join(head_taxo)+"\n")

        ord_sids = sorted(map_sids.keys(), key=lambda x: map_sids[x])
        for sid in ord_sids:
            row = ["%s" % sid]
            counts = {}
            for spc in sid_to_spcs.get(sid, []):
                for i, v in enumerate(data_taxo[species_names[spc]]):
                    counts[(i, v)] = counts.get((i, v), 0) + 1

            for i, txs in enumerate(uniq_taxo):
                for tx in txs:
                    row.append("%s" % counts.get((i, tx), 0))
            fo.write(",".join(row)+"\n")


def loadin_spc(occurence_file):
    species = {}
    map_sids = {}
    reverse_map_sids = {}
    pairs = []
    with open(occurence_file) as fp:
        for li, line in enumerate(fp):
            parts = line.strip().split(",")
            if len(parts) == 3:
                if int(parts[0]) == -1:
                    species[int(parts[1])] = parts[2].strip("\"")
                elif int(parts[1]) == -1:
                    map_sids[parts[2].strip("\"")] = int(parts[0])
                    reverse_map_sids[int(parts[0])] = parts[2].strip("\"")
                elif int(parts[2]) == 1:
                    pairs.append((int(parts[0]), int(parts[1])))

    species_names = [species[sk] for sk in sorted(species.keys())]
    sid_to_spcs = dict([(sid, []) for sid in map_sids.keys()])
    for sid_num, spc_num in pairs:
        sid_to_spcs[reverse_map_sids[sid_num]].append(spc_num)
    return sid_to_spcs, map_sids, species_names


def writeout_traits(trt_file, data_traits, keep_traits, species_names):
    with open(trt_file, "w") as fo:
        fo.write("\"%s\"\n" % "\",\"".join(["id"] + [re.sub("FCT_", "", k) for k in keep_traits]))
        for spc in species_names:
            dt = data_traits[spc]
            fo.write(",".join(["\""+spc+"\""] + list(map(str, dt)))+"\n")


def loadin_traits(trt_file):
    head_traits = None
    data_traits = {}
    with open(trt_file) as fp:
        for line in fp:
            parts = line.strip().split(",")
            if head_traits is None:
                head_traits = [p.strip("\"") for p in parts[1:]]
            else:
                data_traits[parts[0].strip("\"")] = [int(p) if re.match("[0-9]+", p) else -1 for p in parts[1:]]
    return data_traits, head_traits


def filter_sids(lines_bio, additional_bio_vars={}, vars_exps=[], rules=[]):
    sids = []
    head_bio = dict([(v, k) for (k, v) in enumerate(lines_bio[None].strip().split(","))])
    for k, line_bio in lines_bio.items():
        if k is not None:
            parts = line_bio.strip().split(",")
            row = getAddVars(parts, head_bio, "EU", additional_bio_vars, vars_exps)
            inclus = True
            for rule in rules:
                v = row[rule["thres_col"]]
                if rule["thres_type"] == "num":
                    inclus &= ("thres_min" not in out or v >= rule["thres_min"]) and \
                        ("thres_max" not in out or v <= rule["thres_max"])
                elif rule["thres_type"] == "cat":
                    inclus &= (v == rule["thres_val"])
            if inclus:
                sids.append(k)
    return sids


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Preparing the present-day data.')
    parser.add_argument("-i", "--in_directory", type=str, default="../data_present_org/", help="Directory containing original data")
    parser.add_argument("-o", "--out_directory", type=str, default="../data_present_prepared/", help="Directory to store prepared data")
    parser.add_argument("-s", "--suffix", type=str, default="extended", help="File suffix for the series")

    params = vars(parser.parse_args())

    # parser.add_argument("-l", "--localities", type=str, help="List of localities", required=True)
    # parser.add_argument("-t", "--traits", type=str, help="Species dental traits", required=True)

    ## INPUT FILES
    IN_REP = params["in_directory"]
    in_bio_legend_file = IN_REP+"bioclim_legend.txt"
    in_bio_file = IN_REP+"sites_bioclim.csv"
    in_occ_file = IN_REP+"sites_species.csv"
    in_traits_file = IN_REP+"species_traits.csv"
    in_traits_new_file = IN_REP+"species_traits_new.csv"

    ## OUTPUT FILES
    prep_folder = params["out_directory"]
    suffix = params["suffix"]

    if not os.path.exists(prep_folder):
        os.makedirs(prep_folder)

    out_occ_file = prep_folder+"sites_species_"+suffix+".csv"
    out_traits_file = prep_folder+"species_traits_"+suffix+".csv"
    out_agg_file = prep_folder+"sites_traits_"+suffix+".csv"
    out_agg_new_file = prep_folder+"sites_traits_new_"+suffix+".csv"
    out_bio_file = prep_folder+"sites_bioclim_"+suffix+".csv"

    WITH_SPC_LIST = False
    ##

    keep_traits = ["HYP", "LOP", "FCT_HOD", "FCT_AL", "FCT_OL", "FCT_SF", "FCT_OT", "FCT_CM", "OO", "ETH", "LOPT"]
    keep_traits_new = ["HYP", "AL", "AL2", "OL", "SF", "OT", "OO", "BU"]

    keep_taxo = ["ORDER", "FAMILY"]

    key_species = "TAXON"
    NA_val = "NA"

    MIN_NBSPC = 3
    # filter_rules_loc = [{"ext": "_focus", "thres_type": "cat", "thres_side": 1, "thres_col": "Z:AsiaFocus", "thres_val": "In"}]
    filter_rules_loc = [{"ext": "_focus", "thres_type": "cat", "thres_side": 1, "thres_col": "Z:ExtendedFocus", "thres_val": "In"}]

    additional_bio_vars, vars_exps = prepare_dyn_vars()
    data_traits, head_traits, data_taxo = load_traits(in_traits_file, keep_traits, key_species, keep_taxo)

    bio_leg = load_legend_bio(in_bio_legend_file)
    bio_leg.update({"lon_bio": "longitude", "lat_bio": "latitude", "SITE": "ID"})
    lines_bio = load_lines_bio(in_bio_file, ["CONT", "NO_SPECIES", "NO_ORDERS", "NO_FAMILIES", "GlobalID"], "SITE", bio_leg)

    focus_sids = filter_sids(lines_bio, additional_bio_vars, vars_exps, filter_rules_loc)

    sid_to_spcs, species_names = collect_occurrence(in_occ_file, set(focus_sids), MIN_NBSPC)

    sorted_sids = sorted(sid_to_spcs.keys(), key=lambda x: int(x))
    map_sids = dict([(v, k) for (k, v) in enumerate(sorted_sids)])

    writeout_spc(out_occ_file, sid_to_spcs, map_sids, species_names)
    writeout_traits(out_traits_file, data_traits, keep_traits, species_names)

    aggregate_traits(in_occ_file, out_agg_file, data_traits, keep_traits, sid_to_spcs)

    writeout_bio(out_bio_file, lines_bio, additional_bio_vars, vars_exps, sorted_sids)

    data_traits, head_traits, _ = load_traits(in_traits_file, keep_traits, key_species)

    sid_to_spcs, map_sids, species_names = loadin_spc(out_occ_file)
    data_traits_new, head_traits_new = loadin_traits(in_traits_new_file)
    map_traits_new = dict([(v, k) for (k, v) in enumerate(head_traits_new)])

    traits_sets = [{"data_traits": data_traits, "keep_traits": keep_traits, "pref_traits": "%s_v0"},
                   {"data_traits": data_traits_new, "keep_traits": keep_traits_new, "pref_traits": "%s_v1", "map_traits": map_traits_new, "enable_traits": True},
                   ]

    aggregate_traits_multi(in_occ_file, out_agg_new_file, traits_sets, sid_to_spcs, with_spc_list=WITH_SPC_LIST)
