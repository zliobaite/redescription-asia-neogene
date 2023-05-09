// http://0.0.0.0:8888/indexMaps.html?param__nb_init_blocks=1&param__selectable=no&param__pastMrkProps__size=12&param__fdims__LIST=940__680&b2__var_color=rB
// http://0.0.0.0:8888/indexMaps.html?b1__var_color=rA&b1__opacity_bckg=1&b2__var_color=rB&b2__opacity_bckg=1&b3__var_color=rC&b3__opacity_bckg=1&b4__var_color=rD&b4__opacity_bckg=1&b5__var_color=rE&b5__opacity_bckg=1&b6__var_color=rF&b6__opacity_bckg=1&b7__var_color=rG&b7__opacity_bckg=1&b8__var_color=rH&b8__opacity_bckg=1&b9__var_color=rI&b9__opacity_bckg=1
// ls -al ~/TKTL/projects/ecometrics/redescription_china/8_fossil_analysis/plotly/data/ | grep "\->" | awk '{ print "cp -r " $11 " " $9 }' > cp.sh
//var setup_json = "setup_parameters.json";
var DEBUG_DOWNSAMPLE = 0; //50;

var VAR_TYPES = ["rsupp", "dental", "climate"];
var VAR_TYPES_MTCH = {"rsupp": /r[A-Z](.*)$/,
                      "dental": /MEAN_(.*)$/,
                      "climate": /bio([0-9]+):.*$/};

var RED_PROPS = ["query_LHS", "query_RHS"];
var SUPP_LBLS = ["Exo", "Eox", "Exx", "Eoo"];
var SUPP_COLORS = ["#FC5864", "#74A8F6", "#662A8D", "#BBBBBB"];
var SUPP_COLORSCALE = [];
for (let i = 0; i < SUPP_COLORS.length; i++) {
    SUPP_COLORSCALE.push([i/(SUPP_COLORS.length-1), SUPP_COLORS[i]]);
}
var CAT_COLORS = d3.schemeCategory10;
function getCatColorScale(n, has_undefined=false) {
    var cat_colorscale = [];
    let extra = 0;
    if (has_undefined == true){
        cat_colorscale.push([0, "#BBBBBB"]);
        extra = 1;
    }
    for (let i = extra; i < n+extra; i++) {
        cat_colorscale.push([i/(n+extra-1), CAT_COLORS[i % CAT_COLORS.length]]);
    }
    return cat_colorscale;
}
var NUM_COLORSCALE = "YlGnBu";
var AVG_MARK = "---";
var AVG_PREC = 4;
var [BCKG_TRACES_NAME, PRES_TRACES_NAME, PAST_TRACES_NAME, HBARS_TRACES_NAME, HBASE_TRACES_NAME, GEOLN_TRACES_NAME] = ["BCKG", "PRES", "PAST", "HBARS", "HBASE", "GEOLN"];
function isGeoLinesTrace(name) {
    return name == GEOLN_TRACES_NAME;
}
function isGeoBckgTrace(name) {
    return name == BCKG_TRACES_NAME;
}
function isGeoForgTrace(name) {
    return name == PRES_TRACES_NAME || name == PAST_TRACES_NAME;
}
function isHistTrace(name) {
    return name == HBARS_TRACES_NAME || name == HBASE_TRACES_NAME;
}

var NB_INIT_BLOCKS = 2;
var BLOCK_CHAR = "b";
var LIST_VAR_SUFF = "__LIST";
var SPLIT_BLOCK_VAR = "_";
var SPLIT_BLOCK_VLIST = "__";
var FORM_PARAMETERS = [["climate", "climate_model"], ["variable", "var_color"],
                      ["var_filter", "var_filter"], ["val_filter", "val_filter"],
                       ["opacity", "opacity_bckg"]];
var CPARAM_PREF = "param";

// logging
var STATUS_LEGEND = [[-1, "failed"], [0, "drawn"], [1, "drawing"], [2, "refreshing"]];
var LOG_STORE = {};
LOG_STORE["log_track"] = {};
function logCount(log_track){
    let counts = {};
    for (const k of Object.keys(log_track) ){
        if ( ! counts[log_track[k][0]] ){
            counts[log_track[k][0]] = 0;
        }
        counts[log_track[k][0]]++;
    }
    return counts;
}
function logCountStr(log_track){
    let counts_str = [];
    let counts = logCount(log_track);
    for (let i = 0; i < STATUS_LEGEND.length; i++) {
        if ( counts[STATUS_LEGEND[i][0]] > 0){
            counts_str.push(counts[STATUS_LEGEND[i][0]]+" "+STATUS_LEGEND[i][1]);
        }
    }
    return counts_str.join(", ");
}
function isDrawing(log_track){
    return Object.keys(log_track).some((k) => log_track[k][0] > 0);
}
function hasFailed(log_track){
    return Object.keys(log_track).some((k) => log_track[k][0] < 0);
}
function promisePlottingInit(graphDivId, what="new"){
    if (LOG_STORE["log_track"]){
        LOG_STORE["log_track"][graphDivId] = [1*(what != "new")+1, what, new Date()];
        if ( LOG_STORE["log_fun"] && LOG_STORE["log_touid"] == undefined ){
            LOG_STORE["log_touid"] = LOG_STORE["log_fun"](LOG_STORE["log_span"], LOG_STORE["log_track"], LOG_STORE["log_delay"], LOG_STORE["log_fun"]);
        }
        // console.log("Init plotting " + what + " GID:" + graphDivId, logCountStr(LOG_STORE["log_track"]));
    }
}
function promisePlottingDone(event, graphDivId, what="new"){
    if (LOG_STORE["log_track"]){
        LOG_STORE["log_track"][graphDivId][0] = 0;
        // console.log("Done plotting " + what + " GID:" + graphDivId, logCountStr(LOG_STORE["log_track"]));
    }
}
function promisePlottingError(err, graphDivId, what="new"){
    if (LOG_STORE["log_track"]){
        LOG_STORE["log_track"][graphDivId][0] = -1;
        // console.log("Error plotting " + what + " GID:" + graphDivId, logCountStr(LOG_STORE["log_track"]));
    }
}
function promiseLoadingInit(what=""){
    //console.log("Init loading " + what);
}
function promiseLoadingDone(what=""){
    // console.log("Done loading " + what);
}
function promiseLoadingError(err, what=""){
    //console.log("Error loading " + what + "\n", err);
}
function promiseError(err){
    console.log(err);
}

// DATA READING
//---------------------------
var STID = "#ID#";
function loadCSV(csv_file, k, store, stid="#RID#", exclude_ids=null, args_vars={}) {
    promiseLoadingInit("csv "+ csv_file);
    return d3.csv(csv_file,
       function(p, i, cols) {
           return prepareRecord(p, cols[0], stid, exclude_ids, args_vars)
       })
        .then(function (loaded) {
            store[k] = loaded;
            promiseLoadingDone("csv "+ csv_file);
        },
              (err) => promiseLoadingError(err, "csv "+ csv_file)
             );
}
function loadJSON(json_file, k, store) {
    promiseLoadingInit("json "+ json_file);
    return d3.json(json_file)
        .then(function (loaded) {
            store[k] = loaded;
            promiseLoadingDone("json "+ json_file);
        },
              (err) => promiseLoadingError(err, "json "+ json_file)
             );
}

function isVarType(var_name, var_type) {
    return var_name.search(VAR_TYPES_MTCH[var_type]) == 0;
}
function varType(var_name) {
    for (let i = 0; i < VAR_TYPES.length; i++) {
        if ( isVarType(var_name, VAR_TYPES[i]) ) {
            return [i, VAR_TYPES[i]];
        }
    }
    return [VAR_TYPES.length, null];
}
function varSortKey(var_name) {
    var [vtid, vtname] = varType(var_name);
    var vsid = 0;
    if ( vtname == "rsupp" ) {
        vsid = var_name.replace(VAR_TYPES_MTCH[vtname], "$1").length;
    }
    else if ( vtname == "climate" ) {
        vsid = parseInt(var_name.replace(VAR_TYPES_MTCH[vtname], "$1"));
    }
    return [vtid + vsid/1000, var_name];
}


function mapVars(var_name) {
    const new_name = var_name.replace(/([A-Z]+)_v1/, "MEAN_$1").replace(/bioX[0-9A-Z]+:/, "").replace(/Z:/, "Region:").replace(/ *#.*/, "");
    if (new_name != var_name) {
        return new_name;
    };
}
function excludeVars(var_name) {
    return var_name.search(/_v0$/) > -1 || ["NBSP"].includes(var_name);
}
var ARGS_VARS = {"map": mapVars,
                 "exclude": excludeVars};
var EXCLUDE_IDS = ["enabled_col"];

function getLbl(k, r, v, parameters){
    let lbl_str = "<span>"+r["ID"]+"</span>";
    if ( r[parameters["var_color"]] !== undefined ){
        if ( isVarType(parameters["var_color"], "rsupp") ){
            lbl_str += " ("+SUPP_LBLS[r[parameters["var_color"]]]+")";
        }
        else {
            lbl_str += " ("+r[parameters["var_color"]]+")";
        }
    }
    if ( r["NAME"] ){ 
        lbl_str += "<br>"+
            "<b>"+r["NAME"]+"</b><br>"+
            "<i>"+r["MAX_AGE"].toFixed(3)+"-"+r["MIN_AGE"].toFixed(3)+" Ma</i><br>"+
            "<i>lat:"+r["LAT"].toFixed(3)+" long:"+r["LONG"].toFixed(3)+"</i>";
    }
    return lbl_str;
}

function polarToCartesianX(rho, phi){
    return rho * Math.cos(phi*2*Math.PI/100);
}
function polarToCartesianY(rho, phi){
    return rho * Math.sin(phi*2*Math.PI/100);
}
function getMrkXY(k, r, v, parameters){
    xy = {};
    xy[v+"_x"] = r["LONG"];
    xy[v+"_y"] = r["LAT"];
    if ( r["PHI_LBL"] !== undefined && r["RHO_LBL"] !== undefined && r["RHO_LBL"] > 0 ){
        /// polar to cartesian
        xy[v+"_x"] += parameters["frng"] * polarToCartesianX(r["RHO_LBL"], r["PHI_LBL"]);
        xy[v+"_y"] += parameters["frng"] * polarToCartesianY(r["RHO_LBL"], r["PHI_LBL"]);
    }
    return xy;
}
function getPinLineXY(k, r, v, parameters){
    xy = {};
    xy[v+"_x"] = [r["LONG"]];
    xy[v+"_y"] = [r["LAT"]];
    if ( r["PHI_LBL"] !== undefined && r["RHO_LBL"] !== undefined && r["RHO_LBL"] > 0 ){
        /// polar to cartesian
        xy[v+"_x"].push(r["LONG"] + parameters["frng"] * polarToCartesianX(r["RHO_LBL"], r["PHI_LBL"]));
        xy[v+"_y"].push(r["LAT"] + parameters["frng"] * polarToCartesianY(r["RHO_LBL"], r["PHI_LBL"]));
    }
    return xy;
}
function fillParameters(parameters){
    var dyn_parameters = URLSearchToDynParameters(window.location.search);
    if ( Object.keys(dyn_parameters).length > 0 ){
        copyProps(parameters, dyn_parameters);
    }
    parameters["frng"] = 0.012*Math.min(parameters["xlims"][1]-parameters["xlims"][0], parameters["ylims"][1]-parameters["ylims"][0]);
    parameters["configProps"]["width"] = 1.2*parameters["fdims"][0];
    parameters["configProps"]["height"] = parameters["fdims"][1];
    parameters["layoutProps"]["width"] = 1.2*parameters["fdims"][0];
    parameters["layoutProps"]["height"] = parameters["fdims"][1];
    parameters["layoutProps"]["geo"]["lonaxis"]["range"] = parameters["xlims"];
    parameters["layoutProps"]["geo"]["lataxis"]["range"] = parameters["ylims"];
    parameters["split_lines_x"] = [];
    parameters["split_lines_y"] = [];
    parameters["vars_out"] = [["mrk_trc_hovertext", getLbl], ["mrk_trc_text", STID], ["mrk", getMrkXY], ["line", getPinLineXY]];

    if ( parameters["selectable"] == "no"){
        // console.log("Non selectable");
        parameters["layoutProps"]["clickmode"] = "none";
        parameters["presSelProps"]["mode"] = "markers";
        parameters["pastSelProps"]["mode"] = "markers";
    }
    return parameters
}


// DATA TOOLS
//---------------------------
const sssrange = (start, stop, step) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));

function nrange(n) {
    var arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(i);
    }
    return arr;
}
function copyRec(o) {
    if (Array.isArray(o)){
        var c = [];
        for (const v of o){
            c.push(copyRec(v));
        }
    }
    else if (typeof o == "object"){
        var c = {};
        for (const k of Object.keys(o)){
            c[k] = copyRec(o[k]);
        }
    }
    else {
        var c = o;
    }
    return c;
}
function copyProps(oTo, oFrom) {
    // return Object.assign(oTo, oFrom);
    for (const k of Object.keys(oFrom)){
        oTo[k] = copyRec(oFrom[k]);
    }
    return oTo;
}

function qualifyTest(value, testQ, defaultQ=false) {
    if ( typeof testQ === "object" && testQ !== null) {
        return testQ.includes(value);
    }
    else if ( typeof testQ === "function") {
        return testQ(value);
    }
    else if ( testQ !== undefined && testQ !== null) {
        return testQ == value;
    }
    return defaultQ;
}
function mapTest(value, mapQ) {
    if ( typeof mapQ === "object" ) {
        return mapQ[value];
    }
    else if ( typeof mapQ === "function") {
        return mapQ(value);
    }
}

function rtrnRecord(d, argsVars) {
    for (const k of Object.keys(d)){
        if ( qualifyTest(k, argsVars["exclude"]) ){
            delete d[k];
        }
        else {
            if ( qualifyTest(k, argsVars["numerical"]) || ( ! qualifyTest(k, argsVars["text"]) && ! isNaN(d[k]) )) {
                d[k] = +d[k];
            }
            if ( mapTest(k, argsVars["map"]) !== undefined ){
                d[mapTest(k, argsVars["map"])] = d[k];
                delete d[k];
            }
        }
    }
    return d;
}

function prepareRecord(d, orgId, newId, excludeIds, argsVars) {
    r = rtrnRecord(d, argsVars);   
    if ( ! qualifyTest(r[orgId], excludeIds) ){
        if ( newId !== null ) {
            r[newId] = r[orgId];
        }
        return r;
    }
}

function dataMerge(data, varID) {
    return d3.rollup([].concat(...data), v => v.reduce(
        (accumulator, currentValue) => accumulator = copyProps(accumulator, currentValue),
        {}
    ), d => d[varID]);
}

function countValues(data) {
    return d3.rollup(data, v => v.length, d => d);
}

function countKeys(data) {
    var C = {};
    for (let dk of data.keys()){
        Object.keys(data.get(dk)).forEach(k => C[k] = (C[k] ?? 0) + 1);
    }
    return C;
}

function prepareVarList(data, exclude_ks=[], check_all=false) {
    let C = countKeys(data);
    var L = Object.keys(C).filter(k => ! exclude_ks.includes(k) && ! ( check_all && C[k] == data.size));
    return L.sort(function(a, b) {
        var ska = varSortKey(a);
        var skb = varSortKey(b);
        if (ska < skb)
            return -1;
        if (ska > skb)
            return 1;
        return 0; 
    });
}

function asCategoricalVar(var_name, values, parameters) {
    var v_counts = countValues(values, v => v.length, d => d);
    if ( v_counts.size <= parameters["nb_bins"] || Array.from(v_counts.keys()).some((element) => (element !== undefined && isNaN(element))) ) {
        return v_counts;
    }
    return null;
}

function cat2numColors(data, map_values) {
    for (const var_name of Object.keys(data)){
        if ( var_name.search(/_color$/) > -1 ){
            data["back_"+ var_name] = data[var_name];
            var mapped = [];
            for (let i = 0; i < data[var_name].length; i++) {
                mapped.push(map_values.get(data[var_name][i]) ?? -1);
            }
            data[var_name] = mapped;
        }
    }
}

function collectRecordValues(k, r, varsOut, parameters) {
    var vals = {};
    for (const varOut of varsOut){          
        if ( varOut[1] === null ){
            vals[varOut[0]] = k;
        }
        else if (typeof varOut[1] === "function") {
            vv = varOut[1](k, r, varOut[0], parameters);
            if (typeof vv === "object") {                
                copyProps(vals, vv);
            }
            else {
                vals[varOut[0]] = vv;
            }
        }
        else {
            vals[varOut[0]] = r[varOut[1]];
        }
    }
    return vals;
}
function containsTxt(vals, v, defaultI=false) {
    if ( v !== undefined ){
        return vals.some((element) => (element == v));
    }
    return defaultI;
}

function dataGroup(datas, varGroup, varsOut, parameters={}, storeAll={}, data_collect={}, undef_gk=null) {
    for (const data of datas){
        if ( data != null ){
            for (const [k, r] of data){
                // let gk = r[varGroup] ? 0 : undef_gk;
                let gk = r[varGroup] ?? undef_gk;
                let vals = collectRecordValues(k, r, varsOut, parameters);
                // group is empty, because none of the entries qualify, create empty group nevertheless
                if ( data_collect[gk] === undefined ){
                    data_collect[gk] = {};
                    for (const vk of Object.keys(vals)){
                        data_collect[gk][vk] = [];
                    }
                }
                for (const vk of Object.keys(vals)){
                    if ( gk == null || 
                         qualifyTest(r[parameters["var_filter"]], parameters["val_filter"] ?? null, parameters["default_filter"] ?? parameters["val_filter"] === undefined) ){
                        if ( parameters["src_selection"] == vk && containsTxt(parameters["vals_selection"], vals[vk]) ){
                            if ( data_collect[gk][parameters["trg_selection"]] === undefined ){
                                data_collect[gk][parameters["trg_selection"]] = [];         
                            }
                            data_collect[gk][parameters["trg_selection"]].push(data_collect[gk][vk].length);
                        }                            
                        data_collect[gk][vk].push(vals[vk]);
                    }
                    // collect value, to have uniform scale for the same variable with different filters
                    if (storeAll && storeAll[vk]){
                        storeAll[vk].push(vals[vk]);
                    }
                }
            }
        }
    }
    return data_collect;
}

function dataLoad(data_files, stid, exclude_ids, args_vars, data_store={}, name=null){
    var data_promises = [];
    for (const data_k of Object.keys(data_files)) {
        if ( ! data_store[data_k]) {
            data_promises.push(loadCSV(data_files[data_k], data_k, data_store, stid, exclude_ids, args_vars));
        }
    }
    return Promise.all(data_promises).then(
        function(x){
            return [name, dataMerge(Object.values(data_store), stid)];
        },
        (err) => promiseLoadingError(err, "data "+ name + ",".join(data_files))
    );
}


function dataLoadAlts(data_files, names, name_default, stid, exclude_ids, args_vars, data_store={}, data_merged={}){
    var data_promises = [];
    for (let name of names) {
        if ( ! data_merged[name] ){
            name_files = {};
            for (const k of Object.keys(data_files)){
                if (data_files[k].includes(name_default)){
                    name_files[k+"_"+name] = data_files[k].replace(name_default, name);
                }
                else {
                    name_files[k] = data_files[k];
                }
            }
            data_promises.push(dataLoad(name_files, stid, exclude_ids, args_vars, data_store, name));
        }
    }
    return Promise.all(data_promises).then(
        function(loaded_datas){
            return loaded_datas;
        },
        (err) => promiseLoadingError(err, "alternative data "+ ", ".join(names) + ",".join(data_files))
    );
}


// PLOTTING TOOLS
//---------------------------
function makeTracesLines(data, lineProps, trcProps, preff="line_"){
    var lns = [];
    for (let i = 0; i < data[preff+"x"].length; i++) {
        if (data[preff+"x"][i].length > 1){
            ln = {lon: data[preff+"x"][i],
                  lat: data[preff+"y"][i],
                  type: "scattergeo",
                  mode: "lines",
                  hoverinfo: "skip",
                  line: {}
                 }
            if (lineProps !== undefined){
                copyProps(ln["line"], lineProps);
            }
            if (trcProps !== undefined){
                copyProps(ln, trcProps);
            }
            if (data[preff+"props"] !== undefined && Object.keys(data[preff+"props"][i]).length > 0){
                copyProps(ln["line"], data[preff+"props"][i]);
            }
            if (data[preff+"trc_props"] !== undefined && Object.keys(data[preff+"trc_props"][i]).length > 0){
                copyProps(ln, data[preff+"trc_props"][i]);
            }
            lns.push(ln);
        }
    }
    return lns;
}

function copyTracesProps(trcs, data, attProps, trcProps, preff="mrk_", mainAtt="marker", excludeKeys=["x", "y"]){
    if (attProps !== undefined){
        copyProps(trcs[mainAtt], attProps);
    }
    if (trcProps !== undefined){
        copyProps(trcs, trcProps);
    }
    let kt = preff+"trc_";
    for (const k of Object.keys(data)){
        if ( k.startsWith(kt) && ! excludeKeys.includes(k.substring(kt.length))){
            trcs[k.substring(kt.length)] = data[k];
        }
        else if ( k.startsWith(preff) && ! excludeKeys.includes(k.substring(preff.length))){
            trcs[mainAtt][k.substring(preff.length)] = data[k];
        }
    }
    return trcs;
}

    
function makeTracesMrks(data, mrkProps, trcProps, preff="mrk_"){
    var mrks = {lon: data[preff+"x"], 
                lat: data[preff+"y"], 
                type:"scattergeo",
                mode:"markers",
                hoverinfo: "skip",
                marker: {}
               }
    return copyTracesProps(mrks, data, mrkProps, trcProps, preff, "marker");
}

function makeTracesBars(data, barProps, trcProps, preff="bar_"){
    var bars = {x: data[preff+"x"], 
                y: data[preff+"y"],
                type: "bar",
                //width: .98,
                xaxis: "x2",
                yaxis: "y2",
                orientation: "h",
                hoverinfo: "skip",
                marker: {}
               }
    return copyTracesProps(bars, data, barProps, trcProps, preff, "marker");
}

function makeTracesLgds(data, lgdProps, trcProps, preff="lgd_"){    
    var lgds = {x: data[preff+"x"], 
                y: data[preff+"y"],
                mode: "text",
                type: "scatter",
                xaxis: "x2",
                yaxis: "y2",
                hoverinfo: "skip",
                marker: {}
               }
    return copyTracesProps(lgds, data, lgdProps, trcProps, preff, "marker");
}
function prepareGeoLines(block_parameters, common_parameters, setup_parameters){    
    if ( block_parameters["var_filter"] && setup_parameters["geo_lines"][block_parameters["var_filter"]] ){ // && ! block_parameters["val_filter"]){
        let org_lines = setup_parameters["geo_lines"][block_parameters["var_filter"]]["lines"];
        var data_geo_lines = {"line_x": [], "line_y": [], "line_trc_props": []};
        for (var i = 0; i < org_lines.length; i++) {
            let [xA, yA] = org_lines[i]["xyA"];
            let [xB, yB] = org_lines[i]["xyB"];
            if (xA == 0 && xB == 1 && yA == yB){
                xA = common_parameters["layoutProps"]["geo"]["lonaxis"]["range"][0]*(1-common_parameters["geoLinesMrg"])
                    + common_parameters["layoutProps"]["geo"]["lonaxis"]["range"][1]*common_parameters["geoLinesMrg"];
                xB = common_parameters["layoutProps"]["geo"]["lonaxis"]["range"][0]*common_parameters["geoLinesMrg"]
                    + common_parameters["layoutProps"]["geo"]["lonaxis"]["range"][1]*(1-common_parameters["geoLinesMrg"]);
            }
            else if (yA == 0 && yB == 1 && xA == xB){
                yA = common_parameters["layoutProps"]["geo"]["lataxis"]["range"][0]*(1-common_parameters["geoLinesMrg"])
                    + common_parameters["layoutProps"]["geo"]["lataxis"]["range"][1]*common_parameters["geoLinesMrg"];
                yB = common_parameters["layoutProps"]["geo"]["lataxis"]["range"][0]*common_parameters["geoLinesMrg"]
                    + common_parameters["layoutProps"]["geo"]["lataxis"]["range"][1]*(1-common_parameters["geoLinesMrg"]);
            }
            l_xs = [];
            l_ys = [];
            for (var j = 0; j < common_parameters["geoLinesNbSteps"]; j++) {
                l_xs.push(xA*j/common_parameters["geoLinesNbSteps"]
                          +xB*(1-j/common_parameters["geoLinesNbSteps"]));
                l_ys.push(yA*j/common_parameters["geoLinesNbSteps"]
                          +yB*(1-j/common_parameters["geoLinesNbSteps"]));
            }
            data_geo_lines["line_x"].push(l_xs);
            data_geo_lines["line_y"].push(l_ys);
            if ( org_lines[i]["label"] ){
                data_geo_lines["line_trc_props"].push({"text": org_lines[i]["label"], "hoverinfo": "text"});
            }
            else {
                data_geo_lines["line_trc_props"].push({});
            }
        }
        return data_geo_lines;
    }
}


function prepareData(block_parameters, common_parameters, data_past, data_present){
    is_rsupp_var = isVarType(block_parameters["var_color"], "rsupp");
    collect_all = {};
    if ( ! is_rsupp_var ) {
        collect_all["mrk_color"] = [];
    }

    var group_parameters = Object.assign(Object.assign({}, common_parameters), block_parameters);
    group_parameters["var_filter"] = group_parameters["var_filter"] ?? group_parameters["var_color"];
    group_parameters["vals_selection"] = group_parameters["vals_selection"] ?? [];
           
    data_grouped = dataGroup([data_past, data_present], common_parameters["var_group"],
                             [["mrk_color", block_parameters["var_color"]]].concat(common_parameters["vars_out"]),
                             group_parameters, collect_all);

    // PREPARE COLORSCALE DATA, TURN CATEGORICAL VARIABLES TO INTS
    if ( ! is_rsupp_var ) {
        var v_counts = asCategoricalVar(block_parameters["var_color"], collect_all["mrk_color"], common_parameters);
        if ( v_counts !== null ){
            collect_all["has_undefined"] = v_counts.delete(undefined);
            var v_lbls = Array.from(v_counts.keys()).sort(); // (a, b) => v_counts[a] - v_counts[b]);
            var map_values = [];
            for (let i = 0; i < v_lbls.length; i++) {
                map_values.push([v_lbls[i], i]);
            }
            collect_all["lbls"] = v_lbls;
            collect_all["map_values"] = new Map(map_values);

            for (const gk of Object.keys(data_grouped)){
                cat2numColors(data_grouped[gk], collect_all["map_values"]);
            }            
        }
    }

    // PREPARE HISTOGRAM DATA
    var hist_setup = {};
    if ( is_rsupp_var ) {
        hist_setup["is_rsupp_var"] = is_rsupp_var;
        hist_setup["lbls"] = SUPP_LBLS;
        hist_setup["colorscale"] = SUPP_COLORSCALE;
        hist_setup["thres"] = nrange(hist_setup["lbls"].length);
        hist_setup["min"] = 0;
        hist_setup["max"] = hist_setup["lbls"].length-1;
    }
    else if ( collect_all["lbls"] !== undefined ) {
        hist_setup["lbls"] = collect_all["lbls"];
        hist_setup["colorscale"] = getCatColorScale(collect_all["lbls"].length, collect_all["has_undefined"]);
        hist_setup["thres"] = nrange(hist_setup["lbls"].length);
        if ( collect_all["has_undefined"] ){
            hist_setup["min"] = -1;
        }
        else {
            hist_setup["min"] = 0;
        }
        hist_setup["max"] = hist_setup["lbls"].length-1;
    }
    else {
        hist_setup["lbls"] = null;
        [hist_setup["min"], hist_setup["max"]] = d3.extent(collect_all["mrk_color"]);
        let nice = d3.nice(hist_setup["min"], hist_setup["max"], common_parameters["nb_bins"]-1);
        // let step = d3.tickStep(hist_setup["min"], hist_setup["max"], common_parameters["nb_bins"]-1);
        // hist_setup["thres"] = d3.range(nice[0], nice[1]+.5*step, step);
        // hist_setup["thres"] = d3.ticks(hist_setup["min"], hist_setup["max"], common_parameters["nb_bins"]-1);
        hist_setup["thres"] = d3.ticks(nice[0], nice[1], common_parameters["nb_bins"]-1);
        // console.log("nice", nice, hist_setup);
        hist_setup["colorscale"] = NUM_COLORSCALE;
        hist_setup["generator"] = d3.bin()
            .domain([hist_setup["min"], hist_setup["max"]])
            .thresholds(hist_setup["thres"].slice(0, hist_setup["thres"].length-1));
    }
    return [data_grouped, hist_setup];
}

function prepareHist(data, parameters, hist_setup, layout_props, config_props){
    var hist_data = {};
    // numerical variable
    if ( hist_setup["generator"] !== undefined ){
        v_bins = hist_setup["generator"](data["mrk_color"]);
        [hist_data["bar_x"], hist_data["bar_color"], hist_data["bar_trc_width"], hist_data["bar_trc_text"]] = [[], [], [], []];
        hist_data["bar_y"] = hist_setup["thres"];
        var [v_avg, v_std] = [d3.mean(data["mrk_color"]), d3.deviation(data["mrk_color"])];
        if (v_avg !== undefined && v_std !== undefined){
            hist_data["lgd_y"] = [v_avg,
                                  hist_setup["thres"][0]-0.33*(hist_setup["thres"][1]-hist_setup["thres"][0]),
                                  hist_setup["thres"][0]-0.66*(hist_setup["thres"][1]-hist_setup["thres"][0])].concat(hist_setup["thres"]);
            hist_data["lgd_trc_text"] = [AVG_MARK,
                                         "mean = "+v_avg.toFixed(AVG_PREC),
                                         "stdev = "+v_std.toFixed(AVG_PREC)].concat(hist_setup["thres"]);
        }
        else {
            hist_data["lgd_y"] = [hist_setup["thres"][0]-0.66*(hist_setup["thres"][1]-hist_setup["thres"][0])].concat(hist_setup["thres"]);
            hist_data["lgd_trc_text"] = [""].concat(hist_setup["thres"]);
        }
        for (let i = 0; i < v_bins.length; i++) {
            hist_data["bar_x"].push(v_bins[i].length);
            hist_data["bar_color"].push((hist_setup["thres"][i]+hist_setup["thres"][i+1])/2);
            hist_data["bar_trc_width"].push(parameters["barWidth"]*(hist_setup["thres"][i+1]-hist_setup["thres"][i]));
            if (i == 0){
                hist_data["bar_trc_text"].push("["+hist_setup["min"]+","+hist_setup["thres"][i+1]+"] #" + v_bins[i].length);
            }
            else if (i+2 >= hist_setup["thres"].length){
                hist_data["bar_trc_text"].push("["+hist_setup["thres"][i]+","+hist_setup["max"]+"] #" + v_bins[i].length);
            }
            else {                
                hist_data["bar_trc_text"].push("["+hist_setup["thres"][i]+","+hist_setup["thres"][i+1]+"[ #" + v_bins[i].length);
            }
        }
    }
    // rsupp or categorical variable
    else {
        var v_counts = countValues(data["mrk_color"]);
        v_counts.delete(undefined);
        hist_data["v_counts"] = v_counts;
        hist_data["bar_x"] = [];
        hist_data["bar_trc_text"] = [];
        hist_data["bar_y"] = hist_setup["thres"];
        hist_data["bar_color"] = hist_setup["thres"];
        hist_data["bar_trc_width"] = parameters["barWidth"];
        hist_data["lgd_y"] = [];
        hist_data["lgd_trc_text"] = hist_setup["lbls"];
        for (let i = 0; i < hist_setup["lbls"].length; i++) {
            let c = v_counts.get(hist_setup["thres"][i]) ?? 0;
            hist_data["bar_x"].push(c);
            hist_data["bar_trc_text"].push(hist_setup["lbls"][i]+" #" + c);
            hist_data["lgd_y"].push(hist_setup["thres"][i]+0.5);
        }
        layout_props["yaxis2"]["range"] = [hist_setup["thres"][0]-.2, hist_setup["thres"][hist_setup["thres"].length-1]+1.2]; 
    }

    var maxb = d3.max(hist_data["bar_x"].concat([1]));    
    var bbase = .25*maxb;

    hist_data["lgd_x"] = new Array(hist_data["lgd_y"].length).fill(1.25*maxb);
    if ( hist_data["lgd_trc_text"][0] == AVG_MARK ){
        hist_data["lgd_x"][0] = 1.05*maxb;
    }

    layout_props["xaxis2"]["range"] = [1.3*maxb,-bbase];
    hist_data["bbase"] = bbase;
    
    return hist_data;
}

function makeTracesHist(hist_data, csc, parameters, layout_props, config_props) {
    var barProps = copyRec(parameters["barProps"]);
    copyProps(barProps, csc);
    barsHist = makeTracesBars(hist_data, barProps, {"hoverinfo": "text", "offset": 0, "name": HBARS_TRACES_NAME});
    
    hist_data["bar_x"] = new Array(hist_data["bar_x"].length).fill(hist_data["bbase"]*0.75);
    barsSmpl = makeTracesBars(hist_data, barProps, {"hoverinfo": "text", "offset": 0, "base": -hist_data["bbase"]*0.8, "name": HBASE_TRACES_NAME});

    barsLgd = makeTracesLgds(hist_data, copyRec(parameters["lgdProps"]), copyRec(parameters["lgdTrcProps"]));
    
    return [].concat([barsHist, barsSmpl, barsLgd]);
}

function makePlot(graphDivId, data, data_bckg, data_geo_lines, hist_setup, parameters, block_parameters){
    var layout_props = copyRec(parameters["layoutProps"]);
    var config_props = copyRec(parameters["configProps"]);
    config_props["toImageButtonOptions"]["filename"] = graphDivId;
    var csc = {"colorscale": hist_setup["colorscale"],
               "cmin": hist_setup["min"],
               "cmax": hist_setup["max"]};
    
///////////////////
// promisePlottingInit(graphDivId);
// Plotly.newPlot(graphDivId, [], layout_props, config_props).then(
//     function(event){
//         promisePlottingDone(event, graphDivId);
//     },
//     (err) => promisePlottingError(err, graphDivId)
// );   
// // WARNING! FOR DEBUG
// }
// function dummy(){
///////////////////
    var hist_data = prepareHist(data ?? data_bckg, parameters, hist_setup, layout_props, config_props);
    var traces = makeTracesHist(hist_data, csc, parameters, layout_props, config_props);
    // Plotly.addTraces(graphDivId, htraces);

    if (data_bckg != null && ( data == null || block_parameters["opacity_bckg"] != 0 )){
        var presMrkProps = copyRec(parameters["presMrkProps"]);
        copyProps(presMrkProps, csc);
        if (data != null){
            if ( block_parameters["opacity_bckg"] !== undefined ){
                presMrkProps["opacity"] = block_parameters["opacity_bckg"];
            }
            mrksPresent = makeTracesMrks(data_bckg, presMrkProps);
            mrksPresent["name"] = BCKG_TRACES_NAME;
            mrksPresent["selected"] = {"marker": {"opacity": presMrkProps["opacity"]}};
            mrksPresent["unselected"] = {"marker": {"opacity": presMrkProps["opacity"]}};
        }
        else {
            presMrkProps["opacity"] = 1;
            mrksPresent = makeTracesMrks(data_bckg, presMrkProps, copyRec(parameters["presSelProps"]));
            mrksPresent["name"] = PRES_TRACES_NAME;
        }
        // Plotly.addTraces(graphDivId, mrksPresent);
        traces.push(mrksPresent);
    }

    if ( data_geo_lines ){
        geoLines = makeTracesLines(data_geo_lines, parameters["geoLineProps"], {"name": GEOLN_TRACES_NAME});
        // Plotly.addTraces(graphDivId, geoLines);
        traces = traces.concat(geoLines);
    }

    if (data != null){
        pinsPast = makeTracesLines(data, parameters["pastPinLineProps"]);
        // Plotly.addTraces(graphDivId, pinsPast);
        traces = traces.concat(pinsPast);
    
        var pastMrkProps = copyRec(parameters["pastMrkProps"]);
        copyProps(pastMrkProps, csc);
        mrksPast = makeTracesMrks(data, pastMrkProps, copyRec(parameters["pastSelProps"]));
        mrksPast["name"] = PAST_TRACES_NAME;
        // Plotly.addTraces(graphDivId, mrksPast);
        traces.push(mrksPast);
    }
    promisePlottingInit(graphDivId);
    Plotly.newPlot(graphDivId, traces, layout_props, config_props).then(
        function(event){
            promisePlottingDone(event, graphDivId);
        },
        (err) => promisePlottingError(err, graphDivId)
    );
    document.getElementById(graphDivId).on('plotly_click', function(event_data) {
        clickEv(event_data, graphDivId, hist_data);
    });
    // document.getElementById(graphDivId).on('plotly_clickannotation', function(event, data) {
    //     Plotly.relayout(graphDivId, 'annotations[' + data.index + ']', 'remove');
    // });
    
}

// block ids
function getDOMPreff(node_type) {
    return node_type+"_";
}
function getDOMClass(node_type) {
    return "plot_"+node_type;
}
function isNodeType(node_id, node_type) {
    return node_id.startsWith(getDOMPreff(node_type));
}
function getDOMBlocks(parent){
    var blocks = [];
    if (parent.hasChildNodes()){
        for (let i = 0; i < parent.childNodes.length; i++) {
            if (  parent.childNodes[i].nodeType == Node.ELEMENT_NODE && isNodeType(parent.childNodes[i].id, "block") ){
                blocks.push(parent.childNodes[i]);
            }
        }
    }
    return blocks;
}
function getDOMBlockPlots(block_id){
    var plots = [];
    for (const element of document.getElementById(getDOMPreff("block")+block_id).getElementsByTagName("div")){
        if ( isNodeType(element.id, "plot") ){
            plots.push(element);
        }
    }
    return plots;
}

function blockId(block_id){
    if ( isNodeType(block_id, "block") ){
        return block_id.slice(getDOMPreff("block").length);
    }
    return block_id;
}
function blockIdToNum(block_id){    
    if ( isNodeType(block_id, "block") ){
        return parseFloat(block_id.slice(getDOMPreff("block").length + BLOCK_CHAR.length));
    }
    return parseFloat(block_id.slice(BLOCK_CHAR.length));
}
function blockNumToId(block_num){
    return BLOCK_CHAR+block_num;
}
function getNewBlockId(parent, ref_block_id){
    let blocks = getDOMBlocks(parent);
    if ( ref_block_id !== undefined && ref_block_id !== null){
        let ref_block_num = blockIdToNum(ref_block_id);
        for (let i = 0; i < blocks.length; i++) {
            if (blockIdToNum(blocks[i].id) == ref_block_num){
                if (i == 0){
                    return blockNumToId(blockIdToNum(blocks[i].id)/2);
                }
                else {
                    return blockNumToId((blockIdToNum(blocks[i-1].id)+blockIdToNum(blocks[i].id))/2);
                }
            }
        }
    }
    if (blocks.length > 0){
        return blockNumToId(Math.ceil(blockIdToNum(blocks[blocks.length-1].id))+1);
    }
    return blockNumToId(1);
}


// DOM functions
function emptyDOMNode(node){
    // node.innerHTML = "";
    while(node.firstChild) {
        node.removeChild(node.firstChild);
    }   
}
function makeDOMBlock(parent, block_id){
    var tpdiv = document.getElementById(getDOMPreff("block")+block_id);
    if ( ! tpdiv ){       
        tpdiv = document.createElement("div");
        tpdiv.id = getDOMPreff("block")+block_id;
        tpdiv.className = getDOMClass("block");

        const block_num = blockIdToNum(block_id);
        const blocks = getDOMBlocks(parent);
        let i = 0;
        while ( i < blocks.length && block_num > blockIdToNum(blocks[i].id)) {
            i++;
        }
        if ( i == blocks.length ){
            parent.appendChild(tpdiv);
        }
        else {
            parent.insertBefore(tpdiv, blocks[i]);
        }
    }
    else {
        emptyDOMNode(tpdiv);
    }
    var capX = document.createElement("div");
    capX.id = getDOMPreff("caption")+block_id;
    capX.className = getDOMClass("caption");
    tpdiv.appendChild(capX);
    return tpdiv;
}

function makeDOMSubBlock(parent, subblock_id){
    var bdiv = document.createElement("div");
    bdiv.id = getDOMPreff("box")+subblock_id;
    bdiv.className = getDOMClass("box");
    var capX = document.createElement("div");
    capX.id = getDOMPreff("caption")+subblock_id;
    capX.className = getDOMClass("caption");
    var pltX = document.createElement("div");
    pltX.id = getDOMPreff("plot")+subblock_id;
    pltX.className = getDOMClass("plot");
    bdiv.appendChild(capX);
    bdiv.appendChild(pltX);
    parent.appendChild(bdiv);
    return bdiv;
}

function makeDOMBlockLiParams(parent_ul, class_name, lbl) {
    let child_li = document.createElement("li");
    child_li.className = class_name+"-param";
    let child_li_lbl = document.createElement("span");
    child_li_lbl.className = "param-lbl";
    child_li_lbl.appendChild(document.createTextNode(lbl));
    child_li.appendChild(child_li_lbl);
    parent_ul.appendChild(child_li);
    return child_li;
}

function makeDOMSelector(parent, selector_id, options_array, option_selected, selector=null) {
    if (selector == null){
        var selector = document.createElement("select");
        selector.id = selector_id;
        parent.appendChild(selector);
    }
    else {
        emptyDOMNode(selector);
    }

    for (var i = 0; i < options_array.length; i++) {
        var currentOption = document.createElement('option');
        currentOption.text = options_array[i];
        selector.appendChild(currentOption);
    }
    if ( option_selected !== undefined && option_selected !== null ){
        selector.value = option_selected;
    }
    return selector;
}
function makeDOMSlider(parent, slider_id, value_range, value_selected, slider=null) {
    if (slider == null){
        var slider = document.createElement("input");
        slider.type = "range";
        slider.id = slider_id;
        parent.appendChild(slider);
    }
    [slider.min, slider.max, slider.step]  = value_range;
    if ( ! isNaN(value_selected) ){
        slider.value = value_selected;
    }
    return slider;

}


function makeDOMBlockHead(maindiv, topcapdiv, block_id, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged){

    const pm_div = document.createElement("div");
    topcapdiv.appendChild(pm_div);
    const span_plus = document.createElement("span");
    span_plus.appendChild(document.createTextNode("+"));
    pm_div.appendChild(span_plus);
    const span_minus = document.createElement("span");
    span_minus.appendChild(document.createTextNode("-"));
    pm_div.appendChild(span_minus);
    // pm_div.appendChild(document.createTextNode("Block "+block_id));
    
    span_minus.addEventListener('click',
                          function (event){
                              blockDeleteEv(block_id);
                          }, false);
    span_plus.addEventListener('click',
                          function (event){
                              blockAddEv(maindiv, block_id, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                          }, false);

    //---------------------------
    const params_red_div = document.createElement("div");
    params_red_div.className = "block-params-redescription";
    topcapdiv.appendChild(params_red_div);
    let top_ul = document.createElement("ul");
    top_ul.className = "block-params";
    params_red_div.appendChild(top_ul);
    

    var variable_selector = makeDOMSelector(makeDOMBlockLiParams(top_ul, "variable", "Variable"),
                                            "variable_selector_"+block_id, setup_parameters["var_list"], block_parameters["var_color"]);
    variable_selector.addEventListener('change',
                                       function (event){
                                           blockUpdateEv("var_color", event.target.value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                                       }, false);

    var climate_selector = makeDOMSelector(makeDOMBlockLiParams(top_ul, "climate", "Climate model"),
                                           "climate_selector_"+block_id, setup_parameters["climate_models"], block_parameters["climate_model"]);
    climate_selector.addEventListener('change',
                                      function (event){
                                          blockUpdateEv("climate_model", event.target.value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                                      }, false);
    
    var var_filter_selector = makeDOMSelector(makeDOMBlockLiParams(top_ul, "var_filter", "Filter variable"),
                                              "var_filter_selector_"+block_id,
                                              [""].concat(Object.keys(setup_parameters["filters"])), block_parameters["var_filter"]);
    var val_filter_selector = makeDOMSelector(makeDOMBlockLiParams(top_ul, "val_filter", "Filter value"),
                                              "val_filter_selector_"+block_id,
                                              [""].concat(setup_parameters["filters"][block_parameters["var_filter"]] ?? []), block_parameters["val_filter"]);
    val_filter_selector.addEventListener('change',
                                       function (event){
                                           blockUpdateEv("val_filter", event.target.value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                                       }, false);

    var_filter_selector.addEventListener('change',
                                         function (event){
                                             filterSetEv(val_filter_selector, "val_filter", event.target.value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                                         }, false);

    var opacity_bckg_slider = makeDOMSlider(makeDOMBlockLiParams(top_ul, "opacity", "Background opacity"),
                                            "opacity_selector_"+block_id, [0, 1, 0.01], block_parameters["opacity_bckg"]?? common_parameters["presMrkProps"]["opacity"]);
    opacity_bckg_slider.addEventListener('change',
                                       function (event){
                                           blockUpdateEv("opacity_bckg", event.target.value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
                                       }, false);

    //---------------------------
    if ( isVarType(block_parameters["var_color"], "rsupp") ){
        let props_red = [];
        for (let prop of common_parameters["red_props"]){
            props_red.push([prop.replaceAll("_", "-"),
                            setup_parameters["redescriptions"][block_parameters["var_color"]][prop]]);
        }
        params_red_div.appendChild(makeSubBlockPropsUl(props_red, class_basis="redescription"));                
    }
    
}
function collectBlockParametersSelection(block_id){
    var sel_ids = [];
    for (let p of getDOMBlockPlots(block_id)){
        for (let ti = 0; ti < p.data.length; ti++) {
            if ( isGeoForgTrace(p.data[ti]["name"]) &&
                 p.data[ti]["selectedpoints"] !== undefined && p.data[ti]["selectedpoints"].length > 0){
                for (let di = 0; di < p.data[ti]["selectedpoints"].length; di++) {
                    sel_ids.push(p.data[ti]["text"][p.data[ti]["selectedpoints"][di]]);
                }
            }
        }
    }
    return sel_ids;
}
function addBlockParametersSelection(block_id, p){
    var sel_ids = collectBlockParametersSelection(block_id);
    if (sel_ids.length > 0){
        p["vals_selection"] = sel_ids;
    }
    return p;
}
function collectBlockParametersForm(block_id, collect_vars=[], default_values={}){
    var parameters = {};
    for (let [which, trg] of collect_vars) {               
        let element = document.getElementById(which+"_selector_"+block_id);
        if (element !== null && element.value != (default_values[which] ?? "")){
            parameters[trg] = element.value;
        }
    }
    return parameters;
}

function formsToURLSearch(collect_vars=[], default_values={}){
    const url_params = new URLSearchParams("");
    let blocks = getDOMBlocks(document.getElementById("main"));
    for (let i = 0; i < blocks.length; i++) {
        let block_id = blockId(blocks[i].id);
        let p = collectBlockParametersForm(block_id, collect_vars, default_values);
        addBlockParametersSelection(block_id, p);
        for (let pk of Object.keys(p)){
            if ( Array.isArray(p[pk]) ){
                url_params.append(block_id+SPLIT_BLOCK_VAR+SPLIT_BLOCK_VAR+pk+LIST_VAR_SUFF, p[pk].join(SPLIT_BLOCK_VLIST));
            }
            else {                
                url_params.append(block_id+SPLIT_BLOCK_VAR+SPLIT_BLOCK_VAR+pk, p[pk]);
            }
        }
    }
    return url_params.toString();
}
function makeURL(url_search){
    return window.location.origin+window.location.pathname+"?"+url_search;
}
function makeURLLink(url_search){    
    var link = document.createElement("a");
    var link_url = makeURL(url_search);
    link.textContent = link_url;
    link.href = link_url;
    return link;
}

function URLSearchToDynParameters(url_search){
    var url_params = new URLSearchParams(url_search);
    var parameters = {};
    const regex_pk = new RegExp(CPARAM_PREF+SPLIT_BLOCK_VAR+SPLIT_BLOCK_VAR+"(.+)$");
    const regex_list = new RegExp("(.+)"+LIST_VAR_SUFF+"$");
    for (const pk of url_params.keys()) {
        let mtch = pk.match(regex_pk);
        if (mtch != null){            
            let vparts;
            let mtch_list = mtch[1].match(regex_list);
            if ( mtch_list != null ){
                vparts = mtch_list[1].split(SPLIT_BLOCK_VLIST);
            }
            else {
                vparts = mtch[1].split(SPLIT_BLOCK_VLIST);
            }
            if (vparts.length > 0){
                let loc_k = vparts[0];
                let vstore = parameters;
                for (let i = 1; i < vparts.length; i++) {
                    if (! vstore[loc_k]){
                        vstore[loc_k] = {};
                    }
                    vstore = vstore[loc_k];
                    loc_k = vparts[i];
                }
                if ( mtch_list != null ){
                    vstore[loc_k] = url_params.get(pk).split(SPLIT_BLOCK_VLIST);
                }
                else {
                    vstore[loc_k] = url_params.get(pk);
                }
            }
        }
    }
    return parameters;
}
function URLSearchToBlocksParameters(url_search){
    var url_params = new URLSearchParams(url_search);
    var parameters = {};
    const regex_pk = new RegExp("("+BLOCK_CHAR+"[^"+SPLIT_BLOCK_VAR+"]+)"+SPLIT_BLOCK_VAR+SPLIT_BLOCK_VAR+"(.+)$");
    const regex_list = new RegExp("(.+)"+LIST_VAR_SUFF+"$");
    for (const pk of url_params.keys()) {
        let mtch = pk.match(regex_pk);
        if (mtch != null){            
            if (! parameters[mtch[1]]){
                parameters[mtch[1]] = {};
            }
            let mtch_list = mtch[2].match(regex_list);
            if ( mtch_list != null ){
                parameters[mtch[1]][mtch_list[1]] = url_params.get(pk).split(SPLIT_BLOCK_VLIST);
            }
            else {
                parameters[mtch[1]][mtch[2]] = url_params.get(pk);
            }
        }
    }
    return parameters;
}    

function initBlocksParameters(default_values, default_nb_init_blocks, var_list){
    var init_parameters = [];
    var url_parameters = URLSearchToBlocksParameters(window.location.search);
    if (Object.keys(url_parameters).length == 0){
        for (let i = 0; i < default_nb_init_blocks; i++) {
            url_parameters[blockNumToId(i+1)] = {};
        }
    }
    var block_ids = Object.keys(url_parameters);
    block_ids.sort(function(a, b) {
        var ska = blockIdToNum(a);
        var skb = blockIdToNum(b);
        if (ska < skb)
            return -1;
        if (ska > skb)
            return 1;
        return 0; 
    });
    let var_id = 0;
    for (let block_id of block_ids){
        url_parameters[block_id]["block_id"] = block_id;
        if (! url_parameters[block_id]["climate_model"]){
            url_parameters[block_id]["climate_model"] = default_values["climate"];
        }
        if (! url_parameters[block_id]["var_color"]){
            if ( var_id < var_list.length ){
                url_parameters[block_id]["var_color"] = var_list[var_id];
                var_id++;}
            else {                
                url_parameters[block_id]["var_color"] = var_list[0];
            }
        }
        init_parameters.push(url_parameters[block_id]);
    }
    return init_parameters;
}
function makeSubBlockPropsUl(props, class_basis="sbb-cap"){
    let cap_ul = document.createElement("ul");
    cap_ul.className = class_basis;
    for (let prop of props){
        if ( prop[1] ){
            let child_li = document.createElement("li");
            child_li.className = prop[0]+"-"+class_basis;
            let child_li_lbl = document.createElement("span");
            child_li_lbl.innerHTML = prop[1];
            child_li.appendChild(child_li_lbl);
            cap_ul.appendChild(child_li);
        }
    }
    return cap_ul;
}

function blockSetup(block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged){
    
    [data_grouped, hist_setup] = prepareData(block_parameters, common_parameters, data_past, data_present);
    data_geo_lines = prepareGeoLines(block_parameters, common_parameters, setup_parameters);
    
    let block_id = block_parameters["block_id"];
    tpdiv = makeDOMBlock(document.getElementById("main"), block_id);
    var topcapdiv = document.getElementById("caption_"+block_id);
    makeDOMBlockHead(document.getElementById("main"), topcapdiv, block_id, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
    
    var dataBckg = null;                
    if (data_grouped[null] !== undefined){
        dataBckg = data_grouped[null];
        delete data_grouped[null];
        
        let subblock_id = block_id + "-bckg";
        makeDOMSubBlock(tpdiv, subblock_id);

        let props_present = [["lbl", "Present day"], ["nb", dataBckg["mrk_color"].length]];
        if ( isVarType(block_parameters["var_color"], "rsupp") ){
            props_present.push(["acc", setup_parameters["redescriptions"][block_parameters["var_color"]]["acc"]]);
        }
        document.getElementById(getDOMPreff("caption")+subblock_id).appendChild(makeSubBlockPropsUl(props_present, "sbb-cap"));
        
        makePlot(getDOMPreff("plot")+subblock_id, null, dataBckg, data_geo_lines, hist_setup, common_parameters, block_parameters);
    }
    
    var gids = Object.keys(data_grouped).sort();
    for (var gi = 0; gi < gids.length; gi++) {
    // WARNING DEBUG
    // for (var gi = 0; gi < 1; gi++) {
        let subblock_id = block_id + "-" + gids[gi];
        makeDOMSubBlock(tpdiv, subblock_id);

        let props_past = [["lbl", setup_parameters["time_intervals"][gi]["lbl"]],
                          ["time", setup_parameters["time_intervals"][gi]["max"]+
                           "&mdash;"+setup_parameters["time_intervals"][gi]["min"]],
                          ["clim", block_parameters["climate_model"] == setup_parameters["climate_default"] ?
                           setup_parameters["time_intervals"][gi]["climate_model"]:
                           block_parameters["climate_model"]],
                          ["nb", data_grouped[gids[gi]]["mrk_color"].length]];
        document.getElementById(getDOMPreff("caption")+subblock_id).appendChild(makeSubBlockPropsUl(props_past, "sbb-cap"));
        
        makePlot(getDOMPreff("plot")+subblock_id, data_grouped[gids[gi]], dataBckg, data_geo_lines, hist_setup, common_parameters, block_parameters);
    }
}

function collectIndices(values, v_bins, v_bottom, xbins=0){
    var idxs = [];
    let v_up = Number.MAX_VALUE;
    let i = 0;
    while ( i < v_bins.length && v_bottom > v_bins[i]) {
        i++;
    }
    if ( i+1 < v_bins.length - xbins ) {
        v_up = v_bins[i+1];
    }
    for (let j = 0; j < values.length; j++) {
        if ( v_bottom <= values[j] && values[j] < v_up ){
            idxs.push(j);
        }
    }
    // console.log("collect indices", v_bottom, v_up, v_bins, values, xbins, "-->", idxs);
    return idxs;
}

function clickEv(event, graphDivId, hist_data){
    if ( event["points"] && event["points"].length == 1 ){
        if ( isHistTrace(event["points"][0]["data"]["name"]) ) {
            // one selection event from the histogram
            updateHistSelection(graphDivId, event["event"]["shiftKey"]==true, event["points"][0]["curveNumber"], event["points"][0]["pointNumber"], event["points"][0], hist_data);
        }
        else if ( isGeoForgTrace(event["points"][0]["data"]["name"]) ) {
            updateGeoSelection(graphDivId, event["event"]["shiftKey"]==true, event["points"][0]["curveNumber"], event["points"][0]["pointNumber"], event["points"][0]);
        }
    }
}
function updatedSelection(updating, di, prev_selected){
    // point already selected -> remove
    if ( prev_selected && prev_selected.includes(di) ){
        if ( updating ){
            return [prev_selected.filter(odi => odi != di), [di]];
        }
        return [[], prev_selected];
    }
    // point not yet selected -> remove
    else if ( prev_selected && updating ){
        var new_selected = [di].concat(prev_selected);
        new_selected.sort();
        return [new_selected, []];
    }
    return [[di], []];
}
function updateGeoSelection(graphDivId, updating, src_ti, src_di, src_dpoint){
    // console.log("updateGeoSelection", graphDivId, updating, src_ti, src_di, src_dpoint);
    var updated_sel = updatedSelection(updating, src_di, src_dpoint["data"]["selectedpoints"])[0];
    if (updated_sel.length == 0){
        updated_sel = null;
    }
    Plotly.restyle(graphDivId, {"selectedpoints": [updated_sel]}, src_ti);
}

function updateHistSelection(graphDivId, updating, src_ti, src_di, src_dpoint, hist_data){
    // console.log("updateHistSelection", graphDivId, updating, src_ti, src_di, src_dpoint, hist_data);
    var [oth_ti, geo_ti] = [-1, -1];
    let block = document.getElementById(graphDivId);
    for (let ti = 0; ti < block.data.length; ti++) {
        if (ti != src_ti && isHistTrace(block.data[ti]["name"]) ){
            oth_ti = ti;
        }
        else if ( isGeoForgTrace(block.data[ti]["name"]) ){
            geo_ti = ti;
        }
    }
    if ( oth_ti > -1 && geo_ti > -1) {
        let [updated_sel, drop_sel] = updatedSelection(updating, src_di, src_dpoint["data"]["selectedpoints"])
        let geo_ids = block.data[geo_ti]["selectedpoints"] ?? [];
        for (let bid_drop of drop_sel) {
            geo_ids = d3.difference(geo_ids, collectIndices(block.data[geo_ti]["marker"]["color"], hist_data["bar_y"], block.data[src_ti]["y"][bid_drop], 1*(hist_data["v_counts"] === undefined)));
        }
        if ( updated_sel.includes(src_di) ){
            if (! updating && updated_sel.length == 1 && block.data[geo_ti]["selectedpoints"]){
                geo_ids = d3.intersection(geo_ids, collectIndices(block.data[geo_ti]["marker"]["color"], hist_data["bar_y"], block.data[src_ti]["y"][src_di], 1*(hist_data["v_counts"] === undefined)));
            }
            else {
                geo_ids = d3.union(geo_ids, collectIndices(block.data[geo_ti]["marker"]["color"], hist_data["bar_y"], block.data[src_ti]["y"][src_di], 1*(hist_data["v_counts"] === undefined)));
            }
        }
        geo_ids = d3.sort(geo_ids);
        // console.log("XX", updating, "h_updated", updated_sel, "h_drop", drop_sel);
        // console.log("geo_ids", geo_ids, "prev:", block.data[geo_ti]["selectedpoints"]);
        if (updated_sel.length == 0){
            updated_sel = null;
        }
        if (geo_ids.length == 0){
            geo_ids = null;
        }
        Plotly.restyle(graphDivId, {"selectedpoints": [updated_sel, updated_sel, geo_ids]}, [src_ti, oth_ti, geo_ti]);
    }
}


function saveSvg(svgData, name) {
    var preface = '<?xml version="1.0" standalone="no"?>\r\n';
    var svgBlob = new Blob([preface, svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function downloadPlots(common_parameters){
    var svgData = "";
    let blocks = getDOMBlocks(document.getElementById("main"));
    for (let i = 0; i < blocks.length; i++) {
        let block_id = blockId(blocks[i].id);
        for (let p of getDOMBlockPlots(block_id)){
            svgEl = p.getElementsByTagName("svg")[0].cloneNode(true);
            svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");        
            svgEl.setAttribute("height", p.layout["height"]);
            svgEl.setAttribute("width", p.layout["width"]);
            svgEl.setAttribute("basename", p.id);
            var bckg_rect = document.createElement("rect");
            bckg_rect.setAttribute("height", p.layout["height"]);
            bckg_rect.setAttribute("width", p.layout["width"]);
            bckg_rect.setAttribute("x", "0");
            bckg_rect.setAttribute("y", "0");
            bckg_rect.setAttribute("style", svgEl.getAttribute("style").replace("background", "fill")+" fill-opacity: 1;");
            svgEl.removeAttribute("style");
            svgEl.insertBefore(bckg_rect, svgEl.children[0]);
            for (const element of svgEl.getElementsByTagName("text")){
                for (let att of ["data-unformatted", "data-math"]){
                    if ( element.hasAttribute(att) ) {
                        element.removeAttribute(att);
                    }
                }
            }
            for (const element of svgEl.getElementsByTagName("g")){
                if ( element.className.baseVal == "draglayer cursor-crosshair" ){
                    element.parentNode.removeChild(element);
                }
            }
            svgData += svgEl.outerHTML;
        }
    }
    saveSvg(svgData, common_parameters["download_filename"]);
}


function filterSetEv(val_filter_selector, field, new_value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged){
    let blockNeedsUpdate = ( block_parameters["val_filter"] !== undefined ) && ( new_value != block_parameters["var_filter"]);    
    if ( ! new_value ){
        delete block_parameters["var_filter"];
    }
    else {
        block_parameters["var_filter"] = new_value;
    }
    var vals = [""].concat(setup_parameters["filters"][new_value] ?? []);
    var v = null;
    if ( vals.includes(block_parameters["val_filter"]) ){
        var v = block_parameters["val_filter"];
    }
    else {
        delete block_parameters["val_filter"];
    }
    makeDOMSelector(null, null, vals, v, val_filter_selector);
    if ( blockNeedsUpdate ){
        blockUpdateEv("val_filter", v, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
    }
    else {
        blockUpdateEv("var_filter", block_parameters["var_filter"], block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
    }
}
function blockDeleteEv(block_id){
    var block = document.getElementById(getDOMPreff("block")+block_id);
    block.parentElement.removeChild(block);
}
function blockAddEv(parent, ref_block_id, ref_block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged){
    let block_id = getNewBlockId(parent, ref_block_id);
    var block_parameters = copyProps({}, ref_block_parameters);
    addBlockParametersSelection(ref_block_id, block_parameters);
    block_parameters["block_id"] = block_id;
    // console.log("ADD", block_parameters);
    blockUpdateEv(null, null, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged);
}


function blockUpdateEv(field, new_value, block_parameters, common_parameters, setup_parameters, data_past, data_present, past_data_store, data_merged){
    // console.log(field, new_value, bi);

    // cases where a restyling is enough
    // OPACITY
    if ( field == "opacity_bckg" &&
         block_parameters["opacity_bckg"] != 1 && block_parameters["opacity_bckg"] != 0 &&
         new_value != 1 && new_value != 0 ){
        for (let p of getDOMBlockPlots(block_parameters["block_id"])){
            let trc_ids = [];
            for (let i = 0; i < p.data.length; i++) {
                if ( isGeoBckgTrace(p.data[i]["name"]) ) {
                    trc_ids.push(i);
                }
            }
            if (trc_ids.length > 0){
                promisePlottingInit(p.id, "restyle opacity");
                Plotly.restyle(p.id, {'marker.opacity': new_value}, trc_ids).then(
                    function(event){
                        promisePlottingDone(event, p.id, "restyle opacity");
                    },
                    (err) => promisePlottingError(err, p.id, "restyle opacity")
                );
            }
        }
        return ;
    }
    else if ( field == "var_filter" ){
        data_geo_lines = prepareGeoLines(block_parameters, common_parameters, setup_parameters);
        for (let p of getDOMBlockPlots(block_parameters["block_id"])){
            let geo_trc_new_pos = p.data.length;
            let geo_trc_old_ids = [];
            for (let i = 0; i < p.data.length; i++) {
                if ( isGeoLinesTrace(p.data[i]["name"]) ) {
                    geo_trc_old_ids.push(i);
                }
                if ( isGeoBckgTrace(p.data[i]["name"]) ) {
                    geo_trc_new_pos = i;
                }
            }
            // console.log(p.id, geo_trc_new_pos, geo_trc_old_ids, data_geo_lines);
            var delete_promises = [];
            if ( geo_trc_old_ids.length > 0 ){
                geo_trc_new_pos = geo_trc_old_ids[0];
                //console.log("deleting geo lines", p.id, geo_trc_old_ids);
                delete_promises.push(Plotly.deleteTraces(p.id, geo_trc_old_ids));
            }
            Promise.all(delete_promises).then((values) => {
                // console.log("deleted geo lines", p.id, geo_trc_old_ids);
                if ( data_geo_lines ){
                    geoLines = makeTracesLines(data_geo_lines, common_parameters["geoLineProps"], {"name": GEOLN_TRACES_NAME});
                    var geo_trc_new_ids = [];
                    for (let i = 0; i < geoLines.length; i++) {
                        geo_trc_new_ids.push(geo_trc_new_pos+i);
                    }
                    // console.log("adding geo lines", p.id, geo_trc_new_ids);
                    promisePlottingInit(p.id, "add geo lines");
                    Plotly.addTraces(p.id, geoLines, geo_trc_new_ids).then(
                        function(event){
                            promisePlottingDone(event, p.id, "add geo lines");
                        },
                        (err) => promisePlottingError(err, p.id, "add geo lines")
                    );
                }
            });
        }
        return;
    }

    // else redraw plots
    if (field !== null) {
        if ( ! new_value ){
            delete block_parameters[field];
        }
        else {
            block_parameters[field] = new_value;
        }
        addBlockParametersSelection(block_parameters["block_id"], block_parameters);
    }
    if ( block_parameters["opacity_bckg"] == 1 ){
        var bclimate_models = [];
    }
    else
    {
        var bclimate_models = [block_parameters["climate_model"]];
    }
    dataLoadAlts(setup_parameters["past_data_files"], bclimate_models, setup_parameters["climate_default"], STID, EXCLUDE_IDS, ARGS_VARS, past_data_store, data_merged)
        .then(function(loaded_alts){
            for (const k of loaded_alts){
                data_merged[k[0]] = k[1];
            }
            if ( block_parameters["opacity_bckg"] == 1 ){
                blockSetup(block_parameters, common_parameters, setup_parameters, null, data_merged[null], past_data_store, data_merged);
            }
            else{
                blockSetup(block_parameters, common_parameters, setup_parameters, data_merged[block_parameters["climate_model"]], data_merged[null], past_data_store, data_merged);
            }
        },
              err => promiseError(err)
             );
    
}

function mkElementTooltip(class_name, icon_name, tooltip_lines=[]){
    var elementT = document.createElement('div');
    var elementI = document.createElement('i');
    var elementM = document.createElement('span');
    elementT.className = "tooltip "+ class_name+"-tooltip";
    elementI.className = "bi bi-"+icon_name;
    elementM.className = "tooltiptext "+class_name+"-tooltiptext";
    if ( tooltip_lines ){
        elementM.innerHTML = tooltip_lines.join("\n");
    }
    elementT.appendChild(elementI);
    elementT.appendChild(elementM);
    return [elementT, elementM];
}
function toogleVisibilityTooltip(infoM){
    if (infoM.style.visibility == "visible"){
        infoM.style.visibility = "hidden";
        infoM.style.opacity = 0;
    }
    else {
        infoM.style.visibility = "visible";
        infoM.style.opacity = 1;
    }
}
function updateLogInfo(logM, log_track, log_delay, fun){
    logM.innerHTML = logCountStr(log_track);
    if (fun && (Object.keys(log_track).length == 0 || isDrawing(log_track))){
        return setTimeout(fun, log_delay, logM, log_track, log_delay, fun);
    }
}

function mainSetup(setup_parameters, data_merged, past_data_store){
    
    var common_parameters = setup_parameters["common_parameters"];
    fillParameters(common_parameters);
    const default_values_form_parameters = {"opacity": common_parameters["presMrkProps"]["opacity"],
                                            "climate": setup_parameters["climate_default"]};

    //------------------
    let [infoT, infoM] = mkElementTooltip("info", "info-circle-fill", setup_parameters["info_text"]);
    document.getElementById("top-line").appendChild(infoT);
    infoT.addEventListener('click',
                           function (event){
                               toogleVisibilityTooltip(infoM);
                           }, false);
    
    let [linkT, linkM] = mkElementTooltip("link", "link-45deg");
    document.getElementById("top-line").appendChild(linkT);
    linkT.addEventListener('click',
                           function (event){
                               emptyDOMNode(linkM);
                               linkM.appendChild(makeURLLink(formsToURLSearch(FORM_PARAMETERS, default_values_form_parameters)));
                               toogleVisibilityTooltip(linkM);
                           }, false);

    if ( common_parameters["download_filename"] ){
        let [downT, downM] = mkElementTooltip("down", "download");
        document.getElementById("top-line").appendChild(downT);
        downT.addEventListener('click',
                               function (event){
                                   downloadPlots(common_parameters);
                               }, false);
    }
    if ( common_parameters["log_delay"] > 0 ){
        var logT = document.createElement('div');
        var logM = document.createElement('span');
        logM.className = "logtext";
        logT.appendChild(logM);
        document.getElementById("top-line").appendChild(logT);
        LOG_STORE["log_delay"] = common_parameters["log_delay"];
        LOG_STORE["log_span"] = logM;
        LOG_STORE["log_fun"] = updateLogInfo;
    }
    //------------------

    
    var blocks_parameters = initBlocksParameters(default_values_form_parameters, common_parameters["nb_init_blocks"] ?? NB_INIT_BLOCKS, setup_parameters["var_list"]);
    
    var models_to_bis = {};
    for (let bi = 0; bi < blocks_parameters.length; bi++) {
        if ( blocks_parameters[bi]["opacity_bckg"] != 1 ){ // only present-day needed
            if ( models_to_bis[blocks_parameters[bi]["climate_model"]] === undefined ){
                models_to_bis[blocks_parameters[bi]["climate_model"]] = [bi];
            }
            else {
                models_to_bis[blocks_parameters[bi]["climate_model"]].push(bi);
            }
        }
        
    }
    dataLoadAlts(setup_parameters["past_data_files"], Object.keys(models_to_bis), setup_parameters["climate_default"], STID, EXCLUDE_IDS, ARGS_VARS, past_data_store, data_merged)
        .then(function(loaded_alts){
            for (const k of loaded_alts){
                data_merged[k[0]] = k[1];
            }
            for (let bi = 0; bi < blocks_parameters.length; bi++) {
                if ( blocks_parameters[bi]["opacity_bckg"] == 1 ){
                    blockSetup(blocks_parameters[bi], common_parameters, setup_parameters, null, data_merged[null], past_data_store, data_merged);
                }
                else{
                    blockSetup(blocks_parameters[bi], common_parameters, setup_parameters, data_merged[blocks_parameters[bi]["climate_model"]], data_merged[null], past_data_store, data_merged);
                }
            }
        },
              err => promiseError(err)
             );
}


// MAIN
function mainDo(setup_json){
    
    d3.json(setup_json)
        .then(function (setup_parameters) {            
        var details_files = setup_parameters["details_files"];

        var details_promises = [];
        for (const details_k of Object.keys(details_files)) {
            details_promises.push(loadJSON(details_files[details_k], details_k, setup_parameters));
        }
        Promise.all(details_promises)
            .then(
                function(xxx){
                    
                    var data_merged = {};
                    dataLoad(setup_parameters["present_data_files"], STID, EXCLUDE_IDS, ARGS_VARS)
                        .then(function(present_data_loaded){
                            data_merged[null] = present_data_loaded[1];

                            if ( DEBUG_DOWNSAMPLE > 0 ){
                                let ks = Array.from(data_merged[null].keys());
                                for (let ki = DEBUG_DOWNSAMPLE; ki < ks.length; ki++) {
                                    data_merged[null].delete(ks[ki]);
                                }
                            }

                            var other_models = [setup_parameters["climate_models"][0], setup_parameters["climate_models"][1]];

                            var past_data_store = {};
                            dataLoad(setup_parameters["past_data_files"], STID, EXCLUDE_IDS, ARGS_VARS, past_data_store)
                                .then(function(past_data_loaded){
                                    data_merged[setup_parameters["climate_default"]] = past_data_loaded[1];
                                    setup_parameters["var_list"] = prepareVarList(past_data_loaded[1], [STID].concat(setup_parameters["exclude_vars_list"]));
                                    mainSetup(setup_parameters, data_merged, past_data_store);
                                },
                                      err => promiseError(err)
                                     );
                        },
                              err => promiseError(err)
                             );                    
                },
                err => promiseError(err)
            );       
    },
          err => promiseError(err)
         );
}
