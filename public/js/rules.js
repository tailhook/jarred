if(!window.jarred_rules) jarred_rules = [];
jarred_rules.push({
    "match": [null, "cpu"],
    "label": "usage",
    "fetch": "*/cpu-*/cpu-idle.rrd",
    "convert": function () {
        var data = jarred.sum(arguments, function(val) { return 100 - val; });
        data[0].label = "CPU Usage (%)";
        return data;
    }
})


