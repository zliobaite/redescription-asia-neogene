#!/bin/python
import os
import subprocess
from bs4 import BeautifulSoup

import pdb

import argparse

# python extract_svgs.py -i ../maps/maps_all_rA-I_present.svg -o ../maps/rA-I/ -x pdf -x jpg
# rename 's/b1/rA/;s/b2/rB/;s/b3/rC/;s/b4/rD/;s/b5/rE/;s/b6/rF/;s/b7/rG/;s/b8/rH/;s/b9/rI/;s/\-bckg//;s/plot_/map_supp_/' ../maps/rA-I/*
# python extract_svgs.py -i ../maps/maps_all_rBC.svg -o ../maps/rBC/ -x pdf -x jpg
# rename 's/b1\-([0-9])/T\1-rB/;s/b2\-([0-9])/T\1-rC/;s/plot_/map_supp_/' ../maps/rBC/*

parser = argparse.ArgumentParser(description='Extracting individual svg figures from single bundle file, and exporting to other formats.')
parser.add_argument("-i", "--input_file", type=str, default="maps_all.svg", help="Input file containing the svg figures.")
parser.add_argument("-o", "--out_directory", type=str, default="./", help="Directory to store the extracted figures")
parser.add_argument("-t", "--template", type=str, default="fig_%d.svg", help="Template filename for the extracted figures if none can be found in the svg.")
parser.add_argument("-s", "--scale", type=float, help="Rescaling factor", default=1)
parser.add_argument("-x", "--export", type=str, choices=["jpg", "pdf"], action='append', default=[], help="Formats to export to")

params = vars(parser.parse_args())

if not os.path.exists(params["out_directory"]):
    os.makedirs(params["out_directory"])

with open(params["input_file"]) as fp:
    soup = BeautifulSoup(fp, "lxml")
    for si, svg in enumerate(soup.find_all("svg")):
        
        basename = params["out_directory"]+svg.attrs.get("basename", params["template"] % si)
        # print("#", si, basename)
        with open(basename+".svg", 'w') as fo:
            fo.write(str(svg)) #.prettify())

        for c in params["export"]:
            convert_cmd = []
            if c == "pdf":
                convert_cmd = ["inkscape", basename+".svg", "--batch-process", "--export-type=pdf", "--export-filename="+basename+".pdf"]
            elif c == "jpg":
                convert_cmd = ["convert", basename+".svg", basename+".jpg"]
                if params["scale"] != 1 and "height" in svg.attrs and "width" in svg.attrs:
                    height = params["scale"]*float(svg.attrs["height"])
                    width = params["scale"]*float(svg.attrs["width"])
                    convert_cmd = [convert_cmd[0], "-scale", "%dx%d" % (height, width)]+convert_cmd[1:]
            if len(convert_cmd) > 0:
                # print(" ".join(convert_cmd))
                subprocess.run(convert_cmd)
