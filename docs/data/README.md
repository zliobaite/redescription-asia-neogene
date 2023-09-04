> [!NOTE]
> This folder contains the input data prepared for the redescription mining algorithm along with the results it produced, as discussed in the manuscript.
> The input data and redescriptions can be [visualized as maps](https://zliobaite.github.io/redescription-asia-neogene/)
> The files can be downloaded and browsed offline, most might also be browsed online. However, all are raw files that constitute input for and output from algorithms and are hence not human-reader friendly.

## Original article:
*The emergence of modern zoogeographic regions in Asia examined through climate–dental trait association patterns*. Under review.

- [manuscript](../../manuscript.pdf)
- [appendix](../../appendix.pdf)
- [maps visualization](https://zliobaite.github.io/redescription-asia-neogene/)

#### Abstract
The complex and contrasted distribution of terrestrial biota in Asia has been linked to active tectonics and dramatic climatic changes during the Neogene.
However, the timings of the emergence of these distributional patterns and the underlying climatic and tectonic mechanisms remain disputed. 
Here, we apply a computational data analysis technique, called redescription mining, to track these spatiotemporal phenomena by studying the associations between the prevailing herbivore dental traits of mammalian communities and climatic conditions during the Neogene. 

Our results indicate that the modern latitudinal zoogeographic division emerged after the Middle Miocene climatic transition, and that the modern monsoonal zoogeographic pattern emerged during the late Late Miocene.
Furthermore, the presence of a montane forest biodiversity hotspot in the Hengduan Mountains alongside Alpine fauna on the Tibetan Plateau suggests that the modern distribution patterns may have already existed since the Pliocene.

## List of contents

- Present-day data:
    - `sites_traits_new_extended.csv`, file containing the prepared dental traits data, one present-day locality per row. Left-hand side input data for redescription mining.
    - `sites_bioclim_extended.csv`, file containing the prepared climate data, one present-day locality per row. Right-hand side input data for redescription mining.
    - `supps_present.csv`, file containing the support status of the redescriptions, one present-day locality per row. Output of the redescription mining.


- Fossil data:
    - `sites_traits_past.csv`, file containing the prepared dental traits data, one fossil locality per row. Left-hand side input data for redescription evaluation.
    - `sites_paleoclim`, folder containing the prepared climate data, one file per paleoclimate model simulation, each with one fossil locality per row. Right-hand side input data for redescription evaluation.
    - `redescriptions_supps`, folder containing the support status of the redescriptions, one file per paleoclimate model simulation, each with one fossil locality per row. Output of the redescription evaluation.
 

- Context:
    - `localities_list.csv`, file containing the information about fossil localities, i.e. geographic coordinates, age, etc., from the [NOW database](https://nowdatabase.luomus.fi/)
    - `time_intervals.json`, file containing the details of the time intervals
    - `geo_lines.json`, file containing the geographic coordinates for defining the subregions
    - `paleoclimates.json`, file containing the list of paleoclimate model simulations
    - `redescriptions_queries.json`, file containing the queries of the redescriptions as well as their support counts and accuracy. 
    

The support values in `supps_present.csv` and `redescriptions_supps` are as follows:
- **0**: indicates that the locality satisfies the dental traits query but not the climate query, i.e. belongs to the support set denoted as `Exo` typically depicted in *red*
- **1**: indicates that the locality satisfies the climate query but not the dental traits query, i.e. belongs to the support set denoted as `Eox` typically depicted in *blue*
- **2**: indicates that the locality satisfies both the dental traits query and the climate query, i.e. belongs to the support set denoted as `Exx` typically depicted in *purple*
- **3**: indicates that the locality satisfies neither the dental traits query nor the climate query, i.e. belongs to the support set denoted as `Eoo` typically depicted in *gray*


The code and data that allow the full reproducibility of our analysis, i.e. preparing the input data files, mining the redescription from the present-day data and evaluating them on the fossil data, can be found at the root of this repository.
