import sys
import re
import glob
import os.path
import datetime
import numpy
import matplotlib.pyplot as plt

# python compute_reds.py -x ../mining/preferences_present.xml -y ../mining/preferences_past.xml -s 9 --extra -o ../mining/ -a mine -a filter -a evaluate

PATH_CLIRED = os.path.abspath("./python-clired_mine")
sys.path.append(PATH_CLIRED)
from exec_clired import do_task, load_all

from toolLog import Log
from classData import Data
from classRedescription import Redescription
from classPackage import IOTools
from classContent import BatchCollection
from classConstraints import Constraints

import pdb

import argparse

parser = argparse.ArgumentParser(description='Mining and evaluating redescriptions.')
# Mining with parameters corresponding to latest-extended_i.01o.3m.1_AL a.k.a. lIMP_AL
parser.add_argument("-x", "--preferences_present", type=str, default="../preferences_present.xml", help="Clired preferences file for mining redescriptions from the present-day data")
parser.add_argument("-y", "--preferences_fossil", type=str, default="../preferences_fossil.xml", help="Clired preferences file for evaluating redescriptions on the fossil data")
parser.add_argument("-s", "--shortlist_nb", type=int, help="Number of shorlisted redescriptions", default=9)
parser.add_argument("-o", "--out_directory", type=str, help="Directory to store prepared data", required=True)
parser.add_argument("-a", "--action", type=str, choices=["mine", "filter", "evaluate"], action='append', default=[], help="Actions to perform")

group = parser.add_mutually_exclusive_group()
group.add_argument("--extra", action="store_true", help="Make extra redescriptions to support interpretation", default=argparse.SUPPRESS)
group.add_argument("--no-extra", action="store_false", dest="extra", help=argparse.SUPPRESS, default=argparse.SUPPRESS)

params = vars(parser.parse_args())

PREFERENCES_PRESENT = params["preferences_present"]
PREFERENCES_FOSSIL = params["preferences_fossil"]

REP = params["out_directory"]
SHORTLIST_PRESENT_SUPPORTS = REP + "supps_present.csv"
SHORTLIST_PRESENT_QUERIES = REP + "redescriptions_present.queries"
SHORTLIST_FOSSIL_QUERIES = REP + "redescriptions_past.queries"
SHORTLIST_FOSSIL_JSON = REP + "redescriptions_queries.json"
SHORTLIST_NB = params["shortlist_nb"]
MAKE_EXTRA = params.get("extra", False)

OUT_REP = REP + "redescriptions_supps/"
OUT_QUERIES = OUT_REP + "reds_filtered_%s.queries"
OUT_SUPPS = OUT_REP + "supps_filtered_%s.csv"

PALEOCLIMATE_INSTANCES_JSON = REP + "paleoclimates.json"


NUM_CHARS = dict([(numpy.base_repr(ii, base=25), "%s" % chr(ii+ord("A"))) for ii in range(25)])
NUM_CHARS_LOW = dict([(numpy.base_repr(ii, base=25), "%s" % chr(ii+ord("a"))) for ii in range(25)])


def digit_to_char(n, pad=None, low=False):
    if low:
        num_chars = NUM_CHARS_LOW
    else:
        num_chars = NUM_CHARS
    if pad is None:
        tmp = "".join([num_chars[t] for t in numpy.base_repr(n, base=25)])
    else:
        tmp = ("z"*pad+"".join([num_chars[t] for t in numpy.base_repr(n, base=25)]))[-pad:]
    # print("%s -> %s" % (n, tmp))
    return tmp


def run_mine_present():
    do_task(['X', PREFERENCES_PRESENT])
    
def run_filter_present():
    sargs = ['X', '--task', 'filter', PREFERENCES_PRESENT]
    success, loaded = load_all(sargs)
    params, data, logger, filenames = (loaded["params"], loaded["data"], loaded["logger"], loaded["filenames"])

    # applys vars masks
    constraints = Constraints(params, data, filenames=filenames)
    
    side_translate = 0
    cols_map = {}
    for cc in data.colsSide(side_translate):
        if cc.isEnabled():
            cols_map[cc.getId()] = len(cols_map)

    reds, srcs_reds, all_queries_src = IOTools.collectLoadedReds(loaded)
    bc = BatchCollection(reds, tracks_switch=constraints.getCstr("tracks_switch"))
    actions = constraints.getActionList("redundant")
    ids = bc.selected(actions, constraints=constraints)
    filtered_reds = bc.getItems(ids)

    keep_reds = filtered_reds[:SHORTLIST_NB]    
    padr = len(digit_to_char(len(keep_reds)-1))
    for ri, r in enumerate(keep_reds):
        r.setUid(digit_to_char(ri, padr))
    # rids = ["r%s" % digit_to_char(ri, padr) for ri, r in enumerate(keep_reds)]

    if MAKE_EXTRA:
        # rA and rC restricted to one literal
        for rpi in [0, 2]:
            for ri, (ind, lit) in enumerate(keep_reds[rpi].queries[0].indsLit()):
                # n = data.col(0, lit.colId()).getName().split("_")[0]
                n = digit_to_char(ri, 1, low=True)
                q = keep_reds[rpi].queries[0].minusInd(ind)
                new_red = Redescription.fromQueriesPair((q, keep_reds[rpi].queries[1].copy()), data, copyQ=False, iid=digit_to_char(rpi, padr)+n)
                keep_reds.append(new_red)
    
        ## complements of rA, rB and rC
        for rpi in [0, 1, 2]:
            new_query_D, new_query_C = (keep_reds[rpi].queries[0].copy(), keep_reds[rpi].queries[1].copy())    
            new_query_D.flip()
            new_query_C.flip()
            new_red = Redescription.fromQueriesPair((new_query_D, new_query_C), data, copyQ=False, iid=digit_to_char(rpi, padr)+"c")
            keep_reds.append(new_red)
        
        ## rH split temperature condition
        rpi = 7
        new_query_D, new_query_C = (keep_reds[rpi].queries[0].copy(), keep_reds[rpi].queries[1].copy())
        new_query_C.buk[0].getTerm().lowb = float('-Inf')
        new_red = Redescription.fromQueriesPair((new_query_D, new_query_C), data, copyQ=False, iid=digit_to_char(rpi, padr)+"l")
        keep_reds.append(new_red)
        new_query_D, new_query_C = (keep_reds[rpi].queries[0].copy(), keep_reds[rpi].queries[1].copy())
        new_query_C.buk[0].getTerm().upb = float('Inf')
        new_red = Redescription.fromQueriesPair((new_query_D, new_query_C), data, copyQ=False, iid=digit_to_char(rpi, padr)+"u")
        keep_reds.append(new_red)

    rids = [r.getShortId() for r in keep_reds]
    
    IOTools.outputResults({"queries_out": [SHORTLIST_PRESENT_QUERIES]}, keep_reds)
    
    # print support details of redescriptions in present
    coords = data.getCoords()    
    supp_mat = numpy.array([[int(rname) for rname in data.getRNames()], [c[0] for c in coords[0]], [c[0] for c in coords[1]]]+[r.supports().getVectorABCD() for r in keep_reds]).T
    hds = ",".join(["ID", "LONG", "LAT"]+rids)
    fmts = ["%d", "%f", "%f"]+["%d"]*len(keep_reds)
    numpy.savetxt(SHORTLIST_PRESENT_SUPPORTS, supp_mat, fmt=fmts, delimiter=',', header=hds, comments="")
    
    print("--- Present [%s]" % data.nbRows())
    print("LAT:\t[%s,%s]" % (numpy.min(supp_mat[:,2]), numpy.max(supp_mat[:,2])))
    print("LONG:\t[%s,%s]" % (numpy.min(supp_mat[:,1]), numpy.max(supp_mat[:,1])))

    # print queries and stats of redescriptions in present
    names = data.getNames()
    names[0] = [re.sub("_v1$", "", n) for n in names[0]]
    names[1] = [re.sub("bioX?[0-9]+:", "", n) for n in names[1]]

    rfields = Redescription.getRP().dispHeader(style="html").split("\t")[1:]
    reds_json = []
    for ri, r in enumerate(keep_reds):
        reds_json.append("\"%s\": {\n" % r.getShortId() + \
                             ",\n".join(["\t\t\"%s\": %s%s%s" % (rfields[pi], "\""*(pi<2), piece, "\""*(pi<2)) for pi, piece in enumerate(r.disp(names=names, style="html").split("\t")[1:])]) + "\n\t}")
    with open(SHORTLIST_FOSSIL_JSON, "w") as fo:
        fo.write("{\n"+",\n".join(reds_json)+"\n}")

    # print redescriptions translated to past (subset of variables)
    for red in keep_reds:
        red.query(side_translate).replaceCols(cols_map)
    IOTools.outputResults({"queries_out": [SHORTLIST_FOSSIL_QUERIES]}, keep_reds)
    
    
def run_eval_fossil():

    sargs = ['X', '--task', 'printout', PREFERENCES_FOSSIL]
    success, loaded = load_all(sargs, tasks_load={"params_only": True})
    if not success:
        print(loaded)  # print help message
        sys.exit(2)

    params = loaded["params"]
    src_folder = os.path.dirname(os.path.abspath(PREFERENCES_FOSSIL))
    filenames = IOTools.prepareFilenames(params, src_folder=src_folder)
    logger = Log(verbosity=params["verbosity"], output=filenames["logfile"])

    print(filenames)
    RHS_patt = filenames["RHS_data"]
    parts = RHS_patt.split("*")
    lpreff, lsuff = (len(parts[0]), len(parts[-1]))

    paleoclimate_instances = []
    for fRHS in glob.glob(RHS_patt):
        series = fRHS[lpreff:-lsuff]
        paleoclimate_instances.append(series)
        outq_filename = OUT_QUERIES % series
        outs_filename = OUT_SUPPS % series

        data = Data([filenames["LHS_data"], fRHS]+filenames["add_info"], filenames["style_data"])
        data.loadExtensions(ext_keys=params.get("activated_extensions", []), filenames=filenames.get("extensions"), params=params)

        print("----", fRHS)
        rp = Redescription.getRP()
        reds = []
        try:
            with open(SHORTLIST_FOSSIL_QUERIES) as fd:
                rp.parseRedList(fd, data, reds)
        except IOError:
            reds = []
        supp_mat = numpy.array([[int(rname) for rname in data.getRNames()]]+[r.supports().getVectorABCD() for r in reds]).T
        hds = ",".join(["ID"]+["%s" % r.getShortId() for r in reds])
        # padr = len(digit_to_char(len(reds)-1))
        # hds = ",".join(["ID"]+["r%s" % digit_to_char(ri, padr) for ri, r in enumerate(reds)])
        # hds = ",".join(["%s" % r.getShortId() for r in reds])
        # supp_mat = numpy.array([r.supports().getVectorABCD() for r in reds])
        # hds = ",".join(data.getRNames())
        numpy.savetxt(outs_filename, supp_mat, fmt='%d', delimiter=',', header=hds, comments="")

        params = IOTools.getPrintParams(outq_filename, data)
        params["modifiers"] = rp.getModifiersForData(data)
        IOTools.writeRedescriptions(reds, outq_filename, **params)

    if PALEOCLIMATE_INSTANCES_JSON is not None:
        with open(PALEOCLIMATE_INSTANCES_JSON, "w") as fo:
            fo.write("[\n\"" + "\",\n\"".join(sorted(paleoclimate_instances)) + "\"\n]")



if __name__ == "__main__":

    if not os.path.exists(REP):
       os.makedirs(REP)

    if "mine" in params["action"]:
        print("--- MINING FROM PRESENT")
        run_mine_present()

    if "filter" in params["action"]:
        print("--- FILTERING")
        run_filter_present()

    if "evaluate" in params["action"]:
        if not os.path.exists(OUT_REP):
            os.makedirs(OUT_REP)
            
        print("--- RE-EVALUATING IN PAST")
        run_eval_fossil()   
