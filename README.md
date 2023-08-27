> [!NOTE]
> In this repository, we provide the code and data to allow full reproducibility of our analysis.
> The code that we provide fully automates the data processing pipeline as described in the manuscript.
> In particular, the code allows to extract the necessary data records from the source databases given the areas, time intervals and taxonomic orders of interest (cf. manuscript and appendix).

> Our analysis rests on publicly available data sources, such as [WorldClim](https://worldclim.org/) and the [NOW database](https://nowdatabase.luomus.fi/), which we do not maintain and curate ourselves. The teams behind these databases keep updating them, making edits, correcting and inserting records.
> Therefore, we include snapshots of the databases taken at the time we performed the analysis, so that our results can be replicated by running the provided scripts.
> To download or browse the data, and obtain more details about the data format and curation, please refer to the source databases. 

> Providing these scripts also allows to rerun the analysis on more recent versions of the source databases, or with different choices for the time intervals, areas, taxonomic orders, etc.

> All code is written in [Python](https://www.python.org/). Re-running the analysis from scratch using the code and data provided here by following the instructions below hence requires familiarity with this programming language.
> However, this is definitely not necessary in order to understand our analysis and the discussion in the manuscript.

## Original article:
*The emergence of modern zoogeographic regions in Asia examined through climate–dental traits association patterns*. Under review.

- [manuscript](./manuscript.pdf)
- [appendix](./appendix.pdf)
- [maps visualization](https://zliobaite.github.io/redescription-asia-neogene/)

#### Abstract
The complex and contrasted distribution of terrestrial biota in Asia has been linked to active tectonics and dramatic climatic changes during the Neogene.
However, the timings of the emergence of these distributional patterns and the underlying climatic and tectonic mechanisms remain disputed. 
Here, we apply a computational data analysis technique, called redescription mining, to track these spatiotemporal phenomena by studying the associations between the prevailing herbivore dental traits of mammalian communities and climatic conditions during the Neogene. 

Our results indicate that the modern latitudinal zoogeographic division emerged after the Middle Miocene climatic transition, and that the modern monsoonal zoogeographic pattern emerged during the late Late Miocene.
Furthermore, the presence of a montane forest biodiversity hotspot in the Hengduan Mountains alongside Alpine fauna on the Tibetan Plateau suggests that the modern distribution patterns may already exist since the Pliocene.

## List of contents

- `data_present_org`, climate, species and traits data for the present day

    - `bioclim_legend.txt`, list of [bioclimate variables](https://worldclim.org/data/bioclim.html)
    - `sites_bioclim.csv`, the bioclimate variables, to grid
    - `sites_species.csv`, species occurrences, to grid
    - `species_traits.csv`, dental traits old scores
    - `species_traits_new.csv`, dental traits new scores

- `data_past_org`, climate, species and traits data for the fossil sites

    - `localities_org.csv`, list of localities with ids, geographic coordinates and ages
    - `localities_more.csv`, list of localities with additional information for plotly drawing
    - `species_traits_past.csv`, dental traits new scores
    - `now_export_locsp_public_2022-07-23T11#31#34+0000.csv`, dump of the [NOW database](https://nowdatabase.luomus.fi/locality_list.php) (`Export > All NOW localities, Include species lists, Field separator: Tab`)

    - `sites_paleoclim.zip`, paleoclimate models data
    
    - `time_intervals.json`, details of the time intervals
    - `geo_lines.json`, coordinates for defining the subregions


- `scripts`, for preparing the data and running the analysis

    - `prepare_data_present.py`, preparing the data for the present day
    - `prepare_data_traits.py`, preparing the traits data for the fossil sites
    - `prepare_data_bioclim.py`, preparing the bioclimate models data
    - `compute_avgs.py`, preparing group averages
    - `compute_reds.py`, mining redescriptions, filtering and recomputing on the fossil data 
    - `extract_svgs.py`, extracting individual figures from bundle file

- `mining`, files for mining the redescriptions

    - `preferences_present.xml`, preference file for mining the redescriptions and filtering, on present-day data
    - `preferences_past.xml`, preference file for recomputing the redescriptions, on past data

- `plotly`, files for the plotly webpage to visualize the results
    - `index.html`, main html page
    - `maps.css`, style file
    - `maps_plotly.js`, javascript code
    - `setup_parameters.json`, javascript code


## System and software requirements

The provided scripts are written in Python and have been run on a standard laptop computer with a Linux operating system (Ubuntu 20.04) and Python 3 (v3.10.12).

The scripts use the `csv` (v1.0) `json` (v2.0.9) and `bs4` [BeautifulSoup](https://beautiful-soup-4.readthedocs.io) (v4.10.0) packages to read and write data in different formats, as well as the `numpy` (v1.21.5) and `matplotlib` [Pyplot](https://matplotlib.org/stable/tutorials/introductory/pyplot.html) (v3.5.1) for scientific calculations and plotting.

The data preparation and result post-processing steps (1–4, 6 and 7 below) should take a few minutes at most.

The redescription mining and evaluation step (5 below) uses *Clired*, the command-line user interface that allows to mine and preprocess redescriptions (more details can be found on the [project webpage](http://cs.uef.fi/siren/main/download.html), [GitLab repository](https://gitlab.inria.fr/egalbrun/siren,), [PyPi package](https://pypi.org/project/python-clired/), and [related research publications](http://cs.uef.fi/siren/main/references.html). 
To run this step, you need to ensure that *Clired* is accessible. The source code necessary to replicate the experiments is in the [`mine` folder at commit f154c53b](https://gitlab.inria.fr/egalbrun/siren/-/tree/f154c53b9abda7fd4b4d39c58280686908f39fe5/python-siren/blocks/mine).

Mining redescriptions from the present-day data might take about an hour, whereas evaluating redescriptions on the fossil data should take a few minutes.


## Running the analysis, from preparing the data, to visualizing the results, through mining redescriptions

The following sequence of commands should be run from the script directory.

1. Preparing the dental traits and climate data for the present-day localities
```
python prepare_data_present.py -i ../data_present_org/ -o ../data_present_prepared/ -s extended
```

2. Preparing the dental traits data for the fossil sites
```
python prepare_data_traits.py -n ../data_past_org/now_export_locsp_public_2022-07-23T11#31#34+0000.csv -l ../data_past_org/localities_org.csv -t ../data_past_org/species_traits_past.csv -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -m ../data_past_prepared/sites_traits_meta_past.csv -q ../data_past_org/localities_more.csv -p ../data_past_prepared/localities_list.csv
```

3. Preparing the paleoclimate model data for the fossil sites
```
unzip ../data_past_org/sites_paleoclim.zip -d ../data_past_org/
python prepare_data_bioclim.py -i ../data_past_org/sites_paleoclim/ -o ../data_past_prepared/sites_paleoclim/ -I ../data_past_org/time_intervals.json -p ../data_past_prepared/localities_list.csv -s bioclim_SELECTED
```

4. Preparing the group averages for plotting the temperature, precipitation, bunodonty and hypsodonty trends through the Neogene
```
python compute_avgs.py -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -c ../data_past_prepared/sites_paleoclim/bioclim_SELECTED.csv -p ../data_past_prepared/localities_list.csv -g ../data_past_prepared/group_avgs.csv
```

5. Mining the redescriptions from data for the present day, filtering by row overlap, and evaluating the selected redescriptions for the fossil sites. 
The mining uses *Clired*, the command-line user interface that allows to mine and preprocess redescriptions (more details can be found on the [project webpage](http://cs.uef.fi/siren/main/download.html), [GitLab repository](https://gitlab.inria.fr/egalbrun/siren,), [PyPi package](https://pypi.org/project/python-clired/), and [related research publications](http://cs.uef.fi/siren/main/references.html). 
To run this step, you need to ensure that *Clired* is accessible. The source code necessary to replicate the experiments is in the [`mine` folder at commit f154c53b](https://gitlab.inria.fr/egalbrun/siren/-/tree/f154c53b9abda7fd4b4d39c58280686908f39fe5/python-siren/blocks/mine). After obtaining the code, either edit the `PATH_CLIRED` variable in the `compute_reds.py` script file, or add the `mine` folder (or a link to it) as a subfolder named `python-clired_mine` in the `scripts` folder. Then, you should be able to run the mining, filtering and evaluation as follows

```
python compute_reds.py -x ../mining/preferences_present.xml -y ../mining/preferences_past.xml -s 9 --extra -o ../mining/ -a mine -a filter -a evaluate
```

6. Finally, collecting the files needed for the visualization webpage
```
mkdir ../plotly/data

cp ../data_past_org/geo_lines.json ../plotly/data/
cp ../data_past_org/time_intervals.json ../plotly/data/

cp ../data_present_prepared/sites_traits_new_extended.csv ../plotly/data/
cp ../data_present_prepared/sites_bioclim_extended.csv ../plotly/data/

cp ../data_past_prepared/localities_list.csv ../plotly/data/
cp ../data_past_prepared/sites_traits_past.csv ../plotly/data/

cp -r ../data_past_prepared/sites_paleoclim  ../plotly/data/

cp ../mining/supps_present.csv ../plotly/data/
cp ../mining/paleoclimates.json ../plotly/data/
cp ../mining/redescriptions_queries.json ../plotly/data/
cp -r ../mining/redescriptions_supps ../plotly/data/
```
           
7. The maps for the manuscript are drawn on the visualization webpage for [all nine redescriptions, present-day data](https://zliobaite.github.io/redescription-asia-neogene/index.html?b1__var_color=rA&b1__opacity_bckg=1&b2__var_color=rB&b2__opacity_bckg=1&b3__var_color=rC&b3__opacity_bckg=1&b4__var_color=rD&b4__opacity_bckg=1&b5__var_color=rE&b5__opacity_bckg=1&b6__var_color=rF&b6__opacity_bckg=1&b7__var_color=rG&b7__opacity_bckg=1&b8__var_color=rH&b8__opacity_bckg=1&b9__var_color=rI&b9__opacity_bckg=1) and for [rB and rC, past data](https://zliobaite.github.io/redescription-asia-neogene/index.html?b1__var_color=rB&b2__var_color=rC). If the figures are downloaded as a bundled svg file, the individual figures can be extracted and renamed
```
python extract_svgs.py -i ../maps/maps_all_rA-I_present.svg -o ../maps/rA-I/ -x pdf -x jpg
rename 's/b1/rA/;s/b2/rB/;s/b3/rC/;s/b4/rD/;s/b5/rE/;s/b6/rF/;s/b7/rG/;s/b8/rH/;s/b9/rI/;s/\-bckg//;s/plot_/map_supp_/' ../maps/rA-I/*
python extract_svgs.py -i ../maps/maps_all_rBC.svg -o ../maps/rBC/ -x pdf -x jpg
rename 's/b1\-([0-9])/T\1-rB/;s/b2\-([0-9])/T\1-rC/;s/plot_/map_supp_/' ../maps/rBC/*
```

