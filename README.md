# The emergence of modern zoogeographic regions in Asia through the lens of climate–dental traits association patterns

### Original article:
*The emergence of modern zoogeographic regions in Asia through the lens of climate–dental traits association patterns*. Under review.

- [manuscript](./manuscript.pdf)
- [appendix](./appendix.pdf)
- [maps visualization](https://zliobaite.github.io/redescription-asia-neogene/)

#### Abstract
The complex and contrasted distribution of terrestrial biota in Asia has been linked to active tectonics and dramatic climatic changes during the Neogene.
However, the timings of how these distributional patterns arose and the underlying climatic and tectonic mechanisms remain disputed. 
Here, we apply a computational data analysis technique, called redescription mining, to track these spatiotemporal phenomena by studying the associations between the prevailing herbivore dental traits of mammalian communities and climatic conditions during the Neogene. 

Our results indicate that the modern latitudinal zoogeographic division emerged after the Middle Miocene climatic transition (cs. 14 million years ago), and that the modern monsoonal zoogeographic pattern emerged during the late Late Miocene (ca. 7 Ma).

The presence of a montane forest biodiversity hotspot in the Hengduan Mountains alongside Alpine fauna on the Tibetan Plateau suggests that the modern distribution patterns may already have been established since the Pliocene (ca. 5 Ma).

This work provides an advanced understanding of how tectonics and climate shape the distribution of terrestrial biota in Asia.


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


## Running the analysis, from preparing the data, to visualizing the results, through mining redescriptions

The following sequence of commands should be run from the script directory.

1. First preparing the data for the present-day localities

        `python prepare_data_present.py -i ../data_present_org/ -o ../data_present_prepared/ -s extended`

2. Preparing the traits data for the fossil sites

        `python prepare_data_traits.py -n ../data_past_org/now_export_locsp_public_2022-07-23T11#31#34+0000.csv -l ../data_past_org/localities_org.csv -t ../data_past_org/species_traits_past.csv -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -m ../data_past_prepared/sites_traits_meta_past.csv -q ../data_past_org/localities_more.csv -p ../data_past_prepared/localities_list.csv`

3. Preparing the bioclimate models data for the fossil sites

        `unzip ../data_past_org/sites_paleoclim.zip -d ../data_past_org/`

        `python prepare_data_bioclim.py -i ../data_past_org/sites_paleoclim/ -o ../data_past_prepared/sites_paleoclim/ -I ../data_past_org/time_intervals.json -p ../data_past_prepared/localities_list.csv -s bioclim_SELECTED`

4. Preparing the group averages

        `python compute_avgs.py -I ../data_past_org/time_intervals.json -L ../data_past_org/geo_lines.json -d ../data_past_prepared/sites_traits_past.csv -c ../data_past_prepared/sites_paleoclim/bioclim_SELECTED.csv -p ../data_past_prepared/localities_list.csv -g ../data_past_prepared/group_avgs.csv`

5. Mining the redescriptions from data for the present day, filtering by row overlap, and evaluating the selected redescriptions for the fossil sites. 
Ensure *Clired* is accessible. Either edit the PATH_CLIRED variable which is added to the path, or the `mine` folder for Clired (or a link) as a `python-clired_mine` subfolder of the `scripts` folder [from the Gitlab project (commit SHA f154c53b9abda7fd4b4d39c58280686908f39fe5)](https://gitlab.inria.fr/egalbrun/siren/-/tree/master/python-siren/blocks/mine)

        `python compute_reds.py -x ../mining/preferences_present.xml -y ../mining/preferences_past.xml -s 9 --extra -o ../mining/ -a mine -a filter -a evaluate`

6. Finally, collect the files needed for the plotly webpage

        `mkdir ../plotly/data`

        `cp ../data_past_org/geo_lines.json ../plotly/data/`
        `cp ../data_past_org/time_intervals.json ../plotly/data/`

        `cp ../data_present_prepared/sites_traits_new_extended.csv ../plotly/data/`
        `cp ../data_present_prepared/sites_bioclim_extended.csv ../plotly/data/`

        `cp ../data_past_prepared/localities_list.csv ../plotly/data/`
        `cp ../data_past_prepared/sites_traits_past.csv ../plotly/data/`

        `cp -r ../data_past_prepared/sites_paleoclim  ../plotly/data/`

        `cp ../mining/supps_present.csv ../plotly/data/`
        `cp ../mining/paleoclimates.json ../plotly/data/`
        `cp ../mining/redescriptions_queries.json ../plotly/data/`
        `cp -r ../mining/redescriptions_supps ../plotly/data/`
           
7. The maps for the manuscript are drawn on the plotly webpage for [all nine redescriptions, present-day data](index.html?b1__var_color=rA&b1__opacity_bckg=1&b2__var_color=rB&b2__opacity_bckg=1&b3__var_color=rC&b3__opacity_bckg=1&b4__var_color=rD&b4__opacity_bckg=1&b5__var_color=rE&b5__opacity_bckg=1&b6__var_color=rF&b6__opacity_bckg=1&b7__var_color=rG&b7__opacity_bckg=1&b8__var_color=rH&b8__opacity_bckg=1&b9__var_color=rI&b9__opacity_bckg=1) and for [rB and rC, past data](index.html?b1__var_color=rB&b2__var_color=rC). If the figures are downloaded as a bundled svg file, the individual figures can be extracted and renamed

        `python extract_svgs.py -i ../maps/maps_all_rA-I_present.svg -o ../maps/rA-I/ -x pdf -x jpg`
        `rename 's/b1/rA/;s/b2/rB/;s/b3/rC/;s/b4/rD/;s/b5/rE/;s/b6/rF/;s/b7/rG/;s/b8/rH/;s/b9/rI/;s/\-bckg//;s/plot_/map_supp_/' ../maps/rA-I/*`
        `python extract_svgs.py -i ../maps/maps_all_rBC.svg -o ../maps/rBC/ -x pdf -x jpg`
        `rename 's/b1\-([0-9])/T\1-rB/;s/b2\-([0-9])/T\1-rC/;s/plot_/map_supp_/' ../maps/rBC/*`

