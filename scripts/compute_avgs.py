import csv
import numpy
import pdb

import prepare_data_traits

# python compute_avgs.py -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -c ../data_past_prepared/sites_paleoclim/bioclim_SELECTED.csv -p ../data_past_prepared/localities_list.csv -g ../data_past_prepared/group_avgs.csv

import argparse

parser = argparse.ArgumentParser(description='Averaging variables over groups of localitites.')
parser.add_argument("-p", "--plotlocs", type=str, help="Localities info for plotting (input)", required=True)
parser.add_argument("-d", "--dental_data", type=str, help="Aggregated dental traits per site (input)", required=True)
parser.add_argument("-c", "--climate_data", type=str, help="Climate variables per site (input)", required=True)

parser.add_argument("-I", "--time_intervals", type=str, help="Details of the time intervals (input)", required=True)
parser.add_argument("-L", "--geo_lines", type=str, help="Details of the lines for splitting geographic areas (input)", required=True)

parser.add_argument("-g", "--group_avgs", type=str, help="Details of the lines for splitting geographic areas (ouput)", required=True)

params = vars(parser.parse_args())

TIME_INTERVALS_FILE = params["time_intervals"]
GEO_LINES_FILE = params["geo_lines"]

LOCS_FILE = params["plotlocs"]
TRAITS_FILE = params["dental_data"]
BIOCLIM_FILE = params["climate_data"]

AVGS_FILE = params["group_avgs"]

LOCS_KEY = "LIDNUM"
TRAITS_KEY = "ID"
BIOCLIM_KEY = "ID"

ATT_TIME_INTERVAL = "TIME_INTERVAL"
SKIP_KEYS = ['enabled_col']
FMT = "%.4f"
SEP = ","

time_intervals = prepare_data_traits.load_json(TIME_INTERVALS_FILE)
geo_lines = prepare_data_traits.load_json(GEO_LINES_FILE)
                
splits_dets = [{"series": "Asia_BU", "var": "MEAN_BU", "group": "Groups:Asia", "group_lbls": ["North", "South"]},
               {"series": "China_HYP", "var": "MEAN_HYP", "group": "Groups:China", "group_lbls": ["NW", "SE"]},
               {"series": "Asia_T", "var": "bio1:TMeanY", "group": "Groups:Asia", "group_lbls": ["North", "South"]},
               {"series": "China_P", "var": "bio12:PTotY", "group": "Groups:China", "group_lbls": ["NW", "SE"]}
               ]
    
groups = {}
heads = []
data = {}
for (i, (key, filename)) in enumerate([(LOCS_KEY, LOCS_FILE), (TRAITS_KEY, TRAITS_FILE), (BIOCLIM_KEY, BIOCLIM_FILE)]):
    with open(filename) as csvfile:
        reader = csv.DictReader(csvfile, delimiter=SEP)
        for ri, row in enumerate(reader):
            if ri == 0:
                heads.append(row.keys())
            if row[key] not in SKIP_KEYS:
                if i == 0:
                    data[row[key]] = row
                elif row[key] not in data:
                    pdb.set_trace()
                else:
                    data[row[key]].update(row)

lids = sorted(data.keys())
data_vars = ["LONG", "LAT", ATT_TIME_INTERVAL]+[v["var"] for v in splits_dets]
map_vars = dict([(v, i) for (i, v) in enumerate(data_vars)]) 

data_array = numpy.array([[float(data[r][v]) for v in data_vars] for r in lids])
time_ids = {}
for ti in numpy.unique(data_array[:, map_vars[ATT_TIME_INTERVAL]]):
    time_ids[int(ti)] = set(numpy.where(data_array[:, map_vars[ATT_TIME_INTERVAL]] == ti)[0])
    
group_ids = {}
for gname, gdata in geo_lines.items():
    group_ids[gname] = {}
    tmp_ids = prepare_data_traits.get_group_ids_lines(data_array, gdata["lines"], gdata.get("map_ids"))
    for (i, v) in enumerate(tmp_ids):
        if v not in group_ids[gname]:
            group_ids[gname][v] = []
        group_ids[gname][v].append(i)
            

lines_avgs = []
lines_lids = []
for ki, dets in enumerate(splits_dets):
    collect = ["time_interval", "tx", "variable"]    
    for gi, group_lbl in enumerate(dets["group_lbls"]):
        collect.append("")
        collect.extend(["%s_%s" % (group_lbl, v) for v in ["id", "nb", "avg", "std", "low", "up"]])
    lines_avgs.append(collect)
    lines_lids.append(["time_interval", "variable", "group_lbl", "group_id", "nb", "lids"])

    for ti, td in enumerate(time_intervals):
        collect = [td["lbl"], "%.3f" % ((td["min"]+td["max"])/2), dets["series"]]
        for gi, group_lbl in enumerate(dets["group_lbls"]):            
            idxs = sorted(time_ids[ti].intersection(group_ids[dets["group"]][group_lbl]))
            if len(idxs) > 0:
                meanv = numpy.mean(data_array[idxs, map_vars[dets["var"]]])
                stdv = numpy.std(data_array[idxs, map_vars[dets["var"]]], ddof=1)
            else:
                meanv, stdv = (len(idxs), numpy.nan, 0)
                
            vs = [meanv, stdv, meanv-stdv, meanv+stdv]
            collect.extend(["", "%d" % gi, "%d" % len(idxs)]+[FMT % v for v in vs])
            lines_lids.append([td["lbl"], dets["series"], group_lbl, "%d" % gi, "%d" % len(idxs)]+[lids[i] for i in idxs])

        lines_avgs.append(collect)
        lines_lids.append([])
    lines_avgs.append([])
    lines_lids.append([])
    lines_lids.append([])

with open(AVGS_FILE, "w") as fo:
    fo.write("\n".join([SEP.join(l) for l in lines_avgs+lines_lids]))
