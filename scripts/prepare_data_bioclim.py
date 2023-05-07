import re
import glob
import numpy
import os
import pdb

import prepare_data_present
import prepare_data_traits

# unzip ../data_past_org/sites_paleoclim.zip -d ../data_past_org/
# python prepare_data_bioclim.py -i ../data_past_org/sites_paleoclim/ -o ../data_past_prepared/sites_paleoclim/ -I ../data_past_org/time_intervals.json -p ../data_past_prepared/localities_list.csv -s bioclim_SELECTED

def process_lines_bio(in_files, out_file, std_bio_vars, additional_bio_vars, lids=None):

    fo = open(out_file, "w")
    fo.write(",".join(std_bio_vars+[adv["name"] for adv in additional_bio_vars])+"\n")
    head_bio = dict([(v, k) for (k, v) in enumerate(std_bio_vars)])
    fo.write(",".join(["enabled_col"] +
                      ["T" for i in range(len(std_bio_vars)-1)] +
                      [adv["FT"] for adv in additional_bio_vars])+"\n")

    selected = {}
    for in_file in in_files:
        with open(in_file) as fp:
            for line in fp:
                line = re.sub("\.0+,", ",", re.sub("  *", ",", line.strip()))
                parts = line.split(",")
                add_vars_str = prepare_data_present.getAddVarsStr(parts, head_bio, "EU", additional_bio_vars, vars_exps)
                fo.write(line + "," + add_vars_str + "\n")
                if lids is not None and parts[0] in lids:
                    selected[parts[0]] = line + "," + add_vars_str
    return selected

if __name__ == '__main__':

    import argparse

    parser = argparse.ArgumentParser(description='Preparing climate model data to prepare the variants of that side of dataset.')
    parser.add_argument("-i", "--in_directory", type=str, action='append', dest="in_directories", default=[], help="Directory containing input data", required=True)
    parser.add_argument("-o", "--out_directory", type=str, help="Directory to store prepared data", required=True)

    parser.add_argument("-p", "--plotlocs", type=str, help="Localities info", default=argparse.SUPPRESS)
    parser.add_argument("-I", "--time_intervals", type=str, help="Details of the time intervals", default=argparse.SUPPRESS)
    parser.add_argument("-s", "--selected_model", type=str, help="Basename for the bioclimatic data from the selected model for each locality", default=argparse.SUPPRESS)
    
    params = vars(parser.parse_args())

    os.makedirs(params["out_directory"], exist_ok=True)

    std_bio_vars = ["ID", "longitude", "latitude", "bio1:TMeanY", "bio2:TMeanRngD", "bio3:TIso", "bio4:TSeason", "bio5:TMaxWarmM", "bio6:TMinColdM", "bio7:TRngY", "bio8:TMeanWetQ", "bio9:TMeanDryQ", "bio10:TMeanWarmQ", "bio11:TMeanColdQ", "bio12:PTotY", "bio13:PWetM", "bio14:PDryM", "bio15:PSeason", "bio16:PWetQ", "bio17:PDryQ", "bio18:PWarmQ", "bio19:PColdQ"]

    additional_bio_vars, vars_exps = prepare_data_present.prepare_dyn_vars()
    time_intervals_lids = None
    plotlocs = []
    if params.get("time_intervals") is not None and params.get("plotlocs") is not None: # and params.get("selected_model"):
        time_intervals = prepare_data_traits.load_json(params["time_intervals"])
        plotlocs = prepare_data_traits.load_plotlocs(params["plotlocs"], plotlocs_sep=",")
        time_intervals_lids = {}
        for dts in plotlocs:
            ti = time_intervals[int(dts["TIME_INTERVAL"])]["climate_model"]
            if ti not in time_intervals_lids:
                time_intervals_lids[ti] = set()
            time_intervals_lids[ti].add(dts["LIDNUM"])

    data_selected_interval = {}
    for in_file in glob.glob(params["in_directories"][0]+"/*.txt"):
        basename = os.path.basename(in_file)
        lids = time_intervals_lids.get(re.sub("bioclim_(.*)\.txt", "\\1", basename))

        in_files = [rep+basename for rep in params["in_directories"]]
        out_file = params["out_directory"] + re.sub("txt", "csv", basename)
        dsi = process_lines_bio(in_files, out_file, std_bio_vars, additional_bio_vars, lids)
        data_selected_interval.update(dsi)
        # add_file = add_rep + in_file.split("/")[-1]
        # process_lines_bio([in_file, add_file], out_file, std_bio_vars, additional_bio_vars)

    if len(data_selected_interval) > 0 and params.get("selected_model") is not None:
        ks = sorted(data_selected_interval.keys(), key=lambda x: int(x))
        out_file = params["out_directory"] + params.get("selected_model") +".csv"
        with open(out_file, "w") as fo:
            fo.write(",".join(std_bio_vars+[adv["name"] for adv in additional_bio_vars])+"\n")
            head_bio = dict([(v, k) for (k, v) in enumerate(std_bio_vars)])
            fo.write(",".join(["enabled_col"] +
                      ["T" for i in range(len(std_bio_vars)-1)] +
                      [adv["FT"] for adv in additional_bio_vars])+"\n")

            for dts in plotlocs:
                if dts["LIDNUM"] in data_selected_interval:
                    fo.write(data_selected_interval[dts["LIDNUM"]]+"\n")


        
